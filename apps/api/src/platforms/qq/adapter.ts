import type { PlatformAdapter, WebhookResult } from "#platforms/types";
import { sign, verify } from "#platforms/qq/signature";
import { isMessageEvent, parseMessageEvent, type QQPayload } from "#platforms/qq/events";
import { verifyQQCredentials } from "#platforms/qq/credentials";

// https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/event-emit.html
const OP_DISPATCH = 0;
const OP_CALLBACK_ACK = 12;
const OP_VALIDATION = 13;

const json = (body: unknown, status = 200) => Response.json(body, { status });

function reject(detail: string, status: number, eventType = ""): WebhookResult {
  return { response: json({ error: detail }, status), messages: [], eventType, outcome: "rejected", detail };
}

export const qqAdapter: PlatformAdapter = {
  platform: "qq",

  async handleWebhook(req, body, account): Promise<WebhookResult> {
    if (!account.app_secret) return reject("bot secret not set", 503);
    const appId = req.headers.get("X-Bot-Appid");
    if (account.app_id && appId && appId !== account.app_id) {
      return reject(`app id mismatch: ${appId}`, 403);
    }

    let payload: QQPayload;
    try {
      payload = JSON.parse(body) as QQPayload;
    } catch {
      return reject("invalid json", 400);
    }

    // Setting the callback URL in the QQ console: prove we hold the secret.
    if (payload.op === OP_VALIDATION) {
      const d = payload.d as { plain_token?: string; event_ts?: string } | undefined;
      if (!d?.plain_token || !d.event_ts) return reject("bad validation payload", 400, "op13");
      const signature = await sign(account.app_secret, d.event_ts + d.plain_token);
      return {
        response: json({ plain_token: d.plain_token, signature }),
        messages: [],
        eventType: "op13",
        outcome: "validation",
      };
    }

    const signature = req.headers.get("X-Signature-Ed25519") ?? "";
    const timestamp = req.headers.get("X-Signature-Timestamp") ?? "";
    const eventType = payload.t ?? `op${payload.op}`;
    if (!(await verify(account.app_secret, signature, timestamp, body))) {
      return reject("bad signature", 401, eventType);
    }

    const ack = json({ op: OP_CALLBACK_ACK, d: 0 });
    if (payload.op !== OP_DISPATCH || !isMessageEvent(payload.t)) {
      return { response: ack, messages: [], eventType, outcome: "ignored", detail: "not a message event" };
    }
    const message = parseMessageEvent(payload, body);
    if (!message) return { response: ack, messages: [], eventType, outcome: "ignored", detail: "message without id" };
    return { response: ack, messages: [message], eventType };
  },

  verifyCredentials: (appId, secret) => verifyQQCredentials(appId, secret),
};
