import type { PlatformAdapter, WebhookResult } from "#platforms/types";
import { sign, verify } from "#platforms/qq/signature";
import { isMessageEvent, parseMessageEvent, type QQPayload } from "#platforms/qq/events";

// https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/event-emit.html
const OP_DISPATCH = 0;
const OP_CALLBACK_ACK = 12;
const OP_VALIDATION = 13;

const json = (body: unknown, status = 200) => Response.json(body, { status });

export const qqAdapter: PlatformAdapter = {
  platform: "qq",

  async handleWebhook(req, body, account): Promise<WebhookResult> {
    if (!account.app_secret) return { response: json({ error: "bot secret not set" }, 503), messages: [] };
    const appId = req.headers.get("X-Bot-Appid");
    if (account.app_id && appId && appId !== account.app_id) {
      return { response: json({ error: "app id mismatch" }, 403), messages: [] };
    }

    let payload: QQPayload;
    try {
      payload = JSON.parse(body) as QQPayload;
    } catch {
      return { response: json({ error: "invalid json" }, 400), messages: [] };
    }

    // Setting the callback URL in the QQ console: prove we hold the secret.
    if (payload.op === OP_VALIDATION) {
      const d = payload.d as { plain_token?: string; event_ts?: string } | undefined;
      if (!d?.plain_token || !d.event_ts) return { response: json({ error: "bad validation" }, 400), messages: [] };
      const signature = await sign(account.app_secret, d.event_ts + d.plain_token);
      return { response: json({ plain_token: d.plain_token, signature }), messages: [] };
    }

    const signature = req.headers.get("X-Signature-Ed25519") ?? "";
    const timestamp = req.headers.get("X-Signature-Timestamp") ?? "";
    if (!(await verify(account.app_secret, signature, timestamp, body))) {
      return { response: json({ error: "bad signature" }, 401), messages: [] };
    }

    const ack = json({ op: OP_CALLBACK_ACK, d: 0 });
    if (payload.op !== OP_DISPATCH || !isMessageEvent(payload.t)) return { response: ack, messages: [] };
    const message = parseMessageEvent(payload, body);
    return { response: ack, messages: message ? [message] : [] };
  },
};
