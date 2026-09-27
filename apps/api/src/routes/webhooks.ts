import { Hono } from "hono";
import { isPlatform } from "@stash/shared";
import type { Env } from "#types";
import { findByWebhookKey, touchAccount } from "#accounts";
import { adapterFor } from "#platforms/index";
import { ingestMessages } from "#ingest";

/**
 * Platform callbacks, mounted at /api/webhooks (no session: the adapter
 * checks the platform's signature). The platform only gets its answer once
 * the messages are in D1; if that fails it gets a 500 and delivers again.
 */
export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post("/:platform/:key", async (c) => {
  const platform = c.req.param("platform");
  if (!isPlatform(platform)) return c.json({ error: "unknown platform" }, 404);
  const account = await findByWebhookKey(c.env.DB, platform, c.req.param("key"));
  if (!account || !account.enabled) return c.json({ error: "not found" }, 404);

  const body = await c.req.text();
  const { response, messages } = await adapterFor(platform).handleWebhook(c.req.raw, body, account);
  if (!response.ok) return response;

  if (messages.length) {
    try {
      await ingestMessages(c.env, account, messages);
    } catch (err) {
      console.error("ingest failed", err);
      return c.json({ error: "storage unavailable" }, 500);
    }
  }
  c.executionCtx.waitUntil(touchAccount(c.env.DB, account.id).catch(() => {}));
  return response;
});
