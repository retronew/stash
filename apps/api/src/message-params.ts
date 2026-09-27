import { ATTACHMENT_STATUSES, CHAT_TYPES, PLATFORMS } from "@stash/shared";
import type { MessageQuery } from "#messages";
import { listParam } from "#params";

/** A time bound: ms since epoch, or an ISO date / datetime. */
function timeParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

/**
 * The message filters shared by /api/messages and /api/export:
 * q, platform, account, chat (types), chatid, category (lists comma separated), since / until, media=1, status.
 */
export function messageQueryParams(q: Record<string, string | undefined>): MessageQuery {
  return {
    query: q.q?.trim() || undefined,
    platforms: listParam(q.platform, PLATFORMS),
    accountIds: listParam(q.account),
    chatTypes: listParam(q.chat, CHAT_TYPES),
    chatIds: listParam(q.chatid),
    categories: listParam(q.category),
    since: timeParam(q.since),
    until: timeParam(q.until),
    withMedia: q.media === "1",
    status: ATTACHMENT_STATUSES.find((s) => s === q.status),
  };
}
