import { Hono, type Context } from "hono";
import { isPlatform } from "@stash/shared";
import type { Env } from "#types";
import {
  createAccount,
  getAccount,
  isValidWebhookKey,
  listAccounts,
  setAvatarKey,
  toAccount,
  updateAccount,
  type AccountInput,
} from "#accounts";

/** Bot accounts (App ID / secret / webhook path), mounted at /api/accounts. */
export const accountRoutes = new Hono<{ Bindings: Env }>();

type Ctx = Context<{ Bindings: Env }>;

/** Where webhook URLs point: the configured public origin, else this request's. */
function publicOrigin(c: Ctx): string {
  try {
    if (c.env.BETTER_AUTH_URL) return new URL(c.env.BETTER_AUTH_URL).origin;
  } catch {
    // fall through
  }
  return new URL(c.req.url).origin;
}

/** Validated input, or an error message. */
function parseInput(body: Record<string, unknown>): AccountInput | string {
  const input: AccountInput = {};
  for (const field of ["name", "appId", "appSecret"] as const) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 200) return `invalid ${field}`;
    input[field] = value;
  }
  if (body.webhookKey !== undefined) {
    if (typeof body.webhookKey !== "string" || !isValidWebhookKey(body.webhookKey)) return "invalid webhookKey";
    input.webhookKey = body.webhookKey;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return "invalid enabled";
    input.enabled = body.enabled;
  }
  return input;
}

const isUniqueError = (err: unknown) => err instanceof Error && /UNIQUE/i.test(err.message);

accountRoutes.get("/", async (c) => {
  const rows = await listAccounts(c.env.DB);
  return c.json({ origin: publicOrigin(c), accounts: rows.map(toAccount) });
});

accountRoutes.post("/", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (!isPlatform(body.platform)) return c.json({ error: "unknown platform" }, 400);
  const input = parseInput(body);
  if (typeof input === "string") return c.json({ error: input }, 400);
  try {
    return c.json(toAccount(await createAccount(c.env.DB, body.platform, input)), 201);
  } catch (err) {
    if (isUniqueError(err)) return c.json({ error: "webhook_key_taken" }, 409);
    throw err;
  }
});

accountRoutes.patch("/:id", async (c) => {
  const row = await getAccount(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  const input = parseInput(await c.req.json<Record<string, unknown>>().catch(() => ({})));
  if (typeof input === "string") return c.json({ error: input }, 400);
  try {
    return c.json(toAccount(await updateAccount(c.env.DB, row, input)));
  } catch (err) {
    if (isUniqueError(err)) return c.json({ error: "webhook_key_taken" }, 409);
    throw err;
  }
});

/** Deletes the account, its files in R2, and its messages (ON DELETE CASCADE). */
accountRoutes.delete("/:id", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.r2_key FROM attachments a JOIN messages m ON m.id = a.message_id
     WHERE m.account_id = ? AND a.r2_key IS NOT NULL`,
  )
    .bind(c.req.param("id"))
    .all<{ r2_key: string }>();
  const keys = [...results.map((r) => r.r2_key), avatarKey(c.req.param("id"))];
  // R2 deletes at most 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await c.env.MEDIA.delete(keys.slice(i, i + 1000));
  }
  const res = await c.env.DB.prepare("DELETE FROM bot_accounts WHERE id = ?").bind(c.req.param("id")).run();
  return res.meta.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

// A bot's own picture, stored in the media bucket next to the attachments.
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const avatarKey = (id: string) => `avatars/${id}`;

/** body: the image itself (Content-Type image/*), at most 2 MB. */
accountRoutes.put("/:id/avatar", async (c) => {
  const row = await getAccount(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  const type = c.req.header("content-type") ?? "";
  if (!/^image\/(png|jpeg|gif|webp|svg\+xml|avif)$/.test(type)) return c.json({ error: "unsupported image type" }, 415);
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > AVATAR_MAX_BYTES) return c.json({ error: "image too large" }, 413);
  await c.env.MEDIA.put(avatarKey(row.id), body, { httpMetadata: { contentType: type } });
  await setAvatarKey(c.env.DB, row.id, avatarKey(row.id));
  return c.json(toAccount((await getAccount(c.env.DB, row.id))!));
});

accountRoutes.delete("/:id/avatar", async (c) => {
  const row = await getAccount(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.MEDIA.delete(avatarKey(row.id));
  await setAvatarKey(c.env.DB, row.id, null);
  return c.json(toAccount((await getAccount(c.env.DB, row.id))!));
});

accountRoutes.get("/:id/avatar", async (c) => {
  const object = await c.env.MEDIA.get(avatarKey(c.req.param("id")));
  if (!object) return c.json({ error: "not found" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  // The URL carries ?v=<updated at>, so a new picture gets a new URL.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  // An uploaded SVG must not run scripts when opened directly.
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  return new Response(object.body, { headers });
});
