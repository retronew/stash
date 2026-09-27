// Maps an API request to an action name and a summary, as in PickIt.
// Summaries are message refs (key + params, see @stash/shared/i18n) so the
// audit page can show them in any language; all keys are audit_sum_* in the catalogs.

import type { MessageRef } from "@stash/shared/i18n";

export type Body = Record<string, any>;

export interface Described {
  action: string;
  target?: string;
  summary: MessageRef;
}

type Params = MessageRef["params"];

const msg = (key: string, params?: Params): MessageRef => ({ key: `audit_sum_${key}`, params });

/** 「name」 in the reader's language; "" when empty. */
const quote = (text: unknown): MessageRef | string =>
  text ? { key: "audit_quote", params: { text: String(text) } } : "";

const count = (list: unknown) => (Array.isArray(list) ? list.length : 0);

const BULK_ACTIONS = new Set(["trash", "restore", "purge", "category", "add_tags", "remove_tags"]);

/** MCP tool calls are audited; protocol chatter (initialize, tools/list…) is not. */
function describeMcp(body: Body): Described | false {
  if (body.method !== "tools/call") return false;
  const name = String(body.params?.name ?? "");
  const args = (body.params?.arguments ?? {}) as Body;
  const summary =
    name === "search_messages"
      ? msg("mcp_search", { query: quote(args.query ?? args.text) || "—" })
      : name === "retry_downloads"
        ? msg("mcp_retry")
        : msg("mcp_other", { tool: name });
  return { action: "mcp.call", target: `mcp:${name}`, summary };
}

function describeBulk(body: Body): Described {
  const action = String(body.action);
  const n = count(body.ids);
  if (!BULK_ACTIONS.has(action)) return { action: `message.bulk_${action}`, summary: msg("bulk_other", { op: action, count: n }) };
  const params: Params =
    action === "category"
      ? { count: n, category: quote(body.category) || { key: "audit_sum_uncategorized" } }
      : action === "add_tags" || action === "remove_tags"
        ? { count: n, tags: count(body.tags) ? (body.tags as string[]).map((t) => `#${t}`).join(" ") : "—" }
        : { count: n };
  return { action: `message.bulk_${action}`, summary: msg(`bulk_${action}`, params) };
}

/**
 * Maps a request to an action and summary. `name` is the bot's name looked up
 * before the handler ran (for /api/accounts/:id routes), `res` the JSON
 * response when useful. null = not recognized (logged as "other");
 * false = deliberately not audited.
 */
export function describe(method: string, path: string, body: Body, name: string | undefined, res: Body): Described | null | false {
  const p = path.replace(/^\/api/, "");
  if (p === "/mcp") return method === "POST" ? describeMcp(body) : false;
  if (p === "/auth/sign-out") return { action: "auth.sign_out", summary: msg("sign_out") };
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/messages\/(\d+)(?:\/(\w+))?$/))) {
    const target = `message:${m[1]}`;
    const id = `#${m[1]}`;
    if (!m[2] && method === "DELETE") return { action: "message.trash", target, summary: msg("message_trash", { id }) };
    if (!m[2] && method === "PATCH") return { action: "message.labels", target, summary: msg("message_labels", { id }) };
    if (m[2] === "restore") return { action: "message.restore", target, summary: msg("message_restore", { id }) };
    if (m[2] === "purge") return { action: "message.purge", target, summary: msg("message_purge", { id }) };
  }

  if ((m = p.match(/^\/accounts\/([^/]+)(\/avatar)?$/)) && m[1] !== "verify") {
    const target = `bot:${m[1]}`;
    const label = quote(name ?? body.name) || m[1];
    if (m[2]) return { action: "bot.avatar", target, summary: msg(method === "DELETE" ? "bot_avatar_remove" : "bot_avatar", { label }) };
    if (method === "PATCH") return { action: "bot.update", target, summary: msg("bot_update", { label }) };
    if (method === "DELETE") return { action: "bot.delete", target, summary: msg("bot_delete", { label }) };
  }

  if ((m = p.match(/^\/settings\/retention\/(\w+)$/))) {
    return {
      action: "settings.retention",
      target: `retention:${m[1]}`,
      summary: msg("retention", { target: { key: `audit_retention_${m[1]}` }, days: Number(body.days) || 0 }),
    };
  }

  switch (`${method} ${p}`) {
    case "POST /accounts":
      return { action: "bot.create", target: res.id ? `bot:${res.id}` : undefined, summary: msg("bot_create", { label: quote(body.name) || "—" }) };
    case "POST /accounts/verify":
      return { action: "bot.verify", summary: msg("bot_verify") };
    case "POST /messages/bulk":
      return describeBulk(body);
    case "POST /messages/trash/empty":
      return { action: "message.empty_trash", summary: msg("empty_trash", { count: Number(res.purged) || 0 }) };
    case "POST /media/retry":
      return {
        action: "media.retry",
        summary: Array.isArray(body.ids) ? msg("media_retry", { count: count(body.ids) }) : msg("media_retry_all"),
      };
    case "PUT /analysis/settings":
      return { action: "analysis.settings", summary: msg("analysis_settings") };
    case "POST /analysis/queue":
      return {
        action: "analysis.queue",
        summary: Array.isArray(body.ids)
          ? msg("analysis_queue_ids", { count: count(body.ids) })
          : msg("analysis_queue_scope", { scope: { key: `audit_scope_${String(body.scope)}` } }),
      };
    case "POST /analysis/reembed":
      return {
        action: "analysis.reembed",
        summary: msg("reembed", { mode: { key: body.mode === "all" ? "reembed_mode_all" : "reembed_mode_missing" } }),
      };
    case "PUT /settings/allowed-emails":
      return { action: "settings.allowed_emails", summary: msg("allowed_emails", { count: count(body.emails) }) };
    case "PUT /settings/locale":
      return { action: "settings.locale", summary: msg("locale") };
    case "POST /settings/api-token/reset":
      return { action: "settings.api_token_reset", summary: msg("api_token_reset") };
    case "DELETE /settings/api-token":
      return { action: "settings.api_token_delete", summary: msg("api_token_delete") };
    case "POST /settings/ai":
      return { action: "settings.ai_update", summary: msg("ai_update") };
    case "POST /settings/ai/models":
      return { action: "settings.ai_models", summary: msg(body.target === "embedding" ? "ai_models_embedding" : "ai_models_chat") };
    case "POST /settings/ai/test":
      return { action: "settings.ai_test", summary: msg(body.target === "embedding" ? "ai_test_embedding" : "ai_test_chat") };
    case "GET /export/summary":
      return { action: "export.prepare", summary: msg("export_prepare") };
  }
  return null;
}
