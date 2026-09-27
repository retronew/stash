import { getSetting, setSetting } from "#settings";
import { purgeMessages, trashedIds } from "#messages";

// How long each kind of record is kept (days; 0 = forever), how much it
// holds, and pruning. Run by the cron sweep and right after a setting changes.
//
// "tasks" only covers failed downloads: a saved attachment is part of its
// message (and its file in R2), so it goes when the message is purged.
// "trash" purges messages that sat in the recycle bin too long, files included.

export const RETENTION_TARGETS = ["events", "tasks", "trash", "audit"] as const;
export type RetentionTarget = (typeof RETENTION_TARGETS)[number];

export const MAX_RETENTION_DAYS = 3650;
const DAY_MS = 86_400_000;

interface TargetSpec {
  settingKey: string;
  defaultDays: number;
  table: string;
  /** Which rows the setting applies to. */
  where: string;
  timeColumn: string;
  /** Rough bytes of one row's text columns, for the usage estimate. */
  textBytes: string;
}

const SPECS: Record<RetentionTarget, TargetSpec> = {
  events: {
    settingKey: "retention_events_days",
    defaultDays: 30,
    table: "webhook_events",
    where: "1 = 1",
    timeColumn: "received_at",
    textBytes: "length(CAST(raw AS BLOB)) + length(CAST(detail AS BLOB)) + length(event_type) + length(platform) + COALESCE(length(account_id), 0)",
  },
  tasks: {
    settingKey: "retention_failed_tasks_days",
    defaultDays: 30,
    table: "attachments",
    where: "status = 'failed'",
    timeColumn: "updated_at",
    textBytes: "length(CAST(source_url AS BLOB)) + length(CAST(filename AS BLOB)) + length(CAST(last_error AS BLOB)) + length(kind) + length(content_type)",
  },
  audit: {
    settingKey: "retention_audit_days",
    defaultDays: 180,
    table: "audit_log",
    where: "1 = 1",
    timeColumn: "created_at",
    textBytes: "length(CAST(actor AS BLOB)) + length(CAST(action AS BLOB)) + length(CAST(target AS BLOB)) + length(CAST(summary AS BLOB)) + length(CAST(ip AS BLOB)) + length(CAST(user_agent AS BLOB)) + length(CAST(detail AS BLOB))",
  },
  trash: {
    settingKey: "retention_trash_days",
    defaultDays: 30,
    table: "messages",
    where: "deleted_at IS NOT NULL",
    timeColumn: "deleted_at",
    textBytes: "length(CAST(raw AS BLOB)) + length(CAST(text AS BLOB)) + length(CAST(summary AS BLOB)) + length(CAST(ocr_text AS BLOB)) + COALESCE(length(embedding), 0) + COALESCE(length(vec), 0)",
  },
};

/** Per-row overhead (record header, integer columns, indexes) on top of the text. */
const ROW_OVERHEAD = 64;

export interface RetentionStats {
  count: number;
  /** Estimated bytes (D1 has no per-table size). */
  bytes: number;
  oldest: number | null;
}

export interface RetentionInfo {
  days: number;
  stats: RetentionStats;
}

export function isRetentionTarget(value: unknown): value is RetentionTarget {
  return typeof value === "string" && (RETENTION_TARGETS as readonly string[]).includes(value);
}

export function isValidRetention(days: unknown): days is number {
  return Number.isInteger(days) && (days as number) >= 0 && (days as number) <= MAX_RETENTION_DAYS;
}

export async function getRetentionDays(db: D1Database, target: RetentionTarget): Promise<number> {
  const spec = SPECS[target];
  const value = await getSetting(db, spec.settingKey);
  const days = value === null ? spec.defaultDays : Number(value);
  return isValidRetention(days) ? days : spec.defaultDays;
}

export async function setRetentionDays(db: D1Database, target: RetentionTarget, days: number) {
  await setSetting(db, SPECS[target].settingKey, String(days));
}

export async function retentionStats(db: D1Database, target: RetentionTarget): Promise<RetentionStats> {
  const s = SPECS[target];
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, MIN(${s.timeColumn}) AS oldest, COALESCE(SUM(${s.textBytes}), 0) AS text
       FROM ${s.table} WHERE ${s.where}`,
    )
    .first<{ count: number; oldest: number | null; text: number }>();
  return { count: row?.count ?? 0, bytes: (row?.text ?? 0) + (row?.count ?? 0) * ROW_OVERHEAD, oldest: row?.oldest ?? null };
}

export async function retentionInfo(db: D1Database, target: RetentionTarget): Promise<RetentionInfo> {
  const [days, stats] = await Promise.all([getRetentionDays(db, target), retentionStats(db, target)]);
  return { days, stats };
}

/** Deletes rows older than the retention window; returns how many. */
export async function prune(db: D1Database, bucket: R2Bucket, target: RetentionTarget, days?: number): Promise<number> {
  const keep = days ?? (await getRetentionDays(db, target));
  if (keep === 0) return 0;
  if (target === "trash") {
    // Files in R2 go too, so this can't be a plain DELETE.
    return purgeMessages(db, bucket, await trashedIds(db, Date.now() - keep * DAY_MS, 500));
  }
  const s = SPECS[target];
  const res = await db
    .prepare(`DELETE FROM ${s.table} WHERE ${s.where} AND ${s.timeColumn} < ?`)
    .bind(Date.now() - keep * DAY_MS)
    .run();
  return res.meta.changes ?? 0;
}

export async function pruneAll(db: D1Database, bucket: R2Bucket) {
  for (const target of RETENTION_TARGETS) await prune(db, bucket, target);
}
