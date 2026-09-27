import { hasMessage, isMessageRef, renderMessage } from "@stash/shared/i18n";
import { m } from "#lib/i18n";

export interface AuditEntry {
  id: number;
  createdAt: number;
  actor: string;
  action: string;
  target: string;
  summary: string;
  status: number | null;
  ip: string;
  userAgent: string;
  detail: Record<string, unknown>;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: number | null;
}

/** Action prefixes (message.trash → message), for the category filter. */
export const AUDIT_CATEGORIES = ["message", "bot", "analysis", "media", "settings", "export", "mcp", "auth", "other"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const categoryLabel = (c: string) => renderMessage({ key: `audit_category_${c}` });

/** An action's name in the current language; the code itself when there's no translation. */
export function actionLabel(action: string): string {
  const key = `audit_action_${action.replace(/\./g, "_")}`;
  return hasMessage(key) ? renderMessage({ key }) : action;
}

export function isFailure(e: Pick<AuditEntry, "status">): boolean {
  return e.status != null && e.status >= 400;
}

/** The summary in the current language when it was stored as a message ref. */
export function auditSummary(entry: AuditEntry): string {
  const ref = entry.detail?.message;
  return isMessageRef(ref) ? renderMessage(ref) : entry.summary;
}

/** Built-in actors are stored as codes. */
export function actorLabel(actor: string): string {
  if (actor === "anonymous") return m.audit_actor_anonymous();
  if (actor === "api-token") return m.audit_actor_api_token();
  if (actor === "dev") return m.audit_actor_dev();
  return actor;
}
