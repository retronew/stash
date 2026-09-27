import { Hono } from "hono";
import { isPlatform } from "@stash/shared";
import type { Env } from "#types";
import { findByWebhookKey, touchAccount } from "#accounts";
import { adapterFor } from "#platforms/index";
import { ingestMessages } from "#ingest";
import { recordEvents, type EventRecord } from "#events";

/**
 * Platform callbacks, mounted at /api/webhooks (no session: the adapter
 * checks the platform's signature). The platform only gets its answer once
 * the messages are in D1; if that fails it gets a 500 and delivers again.
 * Every call, hit or miss, goes into the event log.
 */
export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post("/:platform/:key", async (c) => {
  const platform = c.req.param("platform");
  if (!isPlatform(platform)) return c.json({ error: "unknown platform" }, 404);
  const body = await c.req.text();
  const log = (records: EventRecord[]) => c.executionCtx.waitUntil(recordEvents(c.env.DB, records));

  const account = await findByWebhookKey(c.env.DB, platform, c.req.param("key"));
  if (!account || !account.enabled) {
    log([
      {
        accountId: account?.id ?? null,
        platform,
        eventType: "",
        outcome: "rejected",
        detail: account ? "bot disabled" : `unknown webhook path: ${c.req.param("key").slice(0, 64)}`,
        raw: body,
      },
    ]);
    return c.json({ error: "not found" }, 404);
  }

  const result = await adapterFor(platform).handleWebhook(c.req.raw, body, account);
  const base = { accountId: account.id, platform, eventType: result.eventType, raw: body };
  c.executionCtx.waitUntil(touchAccount(c.env.DB, account.id).catch(() => {}));

  if (result.messages.length === 0) {
    log([{ ...base, outcome: result.outcome ?? "ignored", detail: result.detail }]);
    return result.response;
  }

  try {
    const saved = await ingestMessages(c.env, account, result.messages);
    log(
      saved.map((s) => ({ ...base, outcome: s.created ? "stored" : "duplicate", messageId: s.messageId })),
    );
  } catch (err) {
    console.error("ingest failed", err);
    log([{ ...base, outcome: "error", detail: err instanceof Error ? err.message : String(err) }]);
    return c.json({ error: "storage unavailable" }, 500);
  }
  return result.response;
});
