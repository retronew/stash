import { Hono, type Context } from "hono";
import { isPlatform } from "@stash/shared";
import type { Env } from "#types";
import {
  createAccount,
  getAccount,
  isValidWebhookKey,
  listAccounts,
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
  // R2 deletes at most 1000 keys per call.
  for (let i = 0; i < results.length; i += 1000) {
    await c.env.MEDIA.delete(results.slice(i, i + 1000).map((r) => r.r2_key));
  }
  const res = await c.env.DB.prepare("DELETE FROM bot_accounts WHERE id = ?").bind(c.req.param("id")).run();
  return res.meta.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});
