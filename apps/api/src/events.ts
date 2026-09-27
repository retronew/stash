import {
  HIT_OUTCOMES,
  type EventOutcome,
  type EventPage,
  type EventStats,
  type Platform,
  type WebhookEvent,
  type WebhookEventDetail,
} from "@stash/shared";

// The webhook event log: every call, hit or miss (see migration 0002).

const RAW_LIMIT = 16 * 1024;
/** Log rows older than this are pruned by the cron sweep. */
export const EVENT_RETENTION_DAYS = 30;

export const OUTCOMES: EventOutcome[] = ["stored", "duplicate", "ignored", "validation", "rejected", "error"];

export interface EventRecord {
  accountId: string | null;
  platform: Platform;
  eventType: string;
  outcome: EventOutcome;
  detail?: string;
  messageId?: number | null;
  raw: string;
}

/** Best effort: a failed log write never fails the webhook. */
export async function recordEvents(db: D1Database, records: EventRecord[]) {
  if (records.length === 0) return;
  const now = Date.now();
  try {
    await db.batch(
      records.map((r) =>
        db
          .prepare(
            `INSERT INTO webhook_events (account_id, platform, event_type, outcome, detail, message_id, raw, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            r.accountId,
            r.platform,
            r.eventType.slice(0, 100),
            r.outcome,
            (r.detail ?? "").slice(0, 500),
            r.messageId ?? null,
            r.raw.slice(0, RAW_LIMIT),
            now,
          ),
      ),
    );
  } catch (err) {
    console.error("event log write failed", err);
  }
}

interface EventRow {
  id: number;
  account_id: string | null;
  platform: Platform;
  event_type: string;
  outcome: EventOutcome;
  detail: string;
  message_id: number | null;
  raw?: string;
  received_at: number;
}

function toEvent(row: EventRow): WebhookEvent {
  return {
    id: row.id,
    accountId: row.account_id,
    platform: row.platform,
    eventType: row.event_type,
    outcome: row.outcome,
    detail: row.detail,
    messageId: row.message_id,
    receivedAt: row.received_at,
  };
}

export interface EventFilter {
  before?: number;
  limit: number;
  accountId?: string;
  /** true: hits only; false: misses only. */
  hit?: boolean;
  outcome?: EventOutcome;
}

const COLUMNS = "id, account_id, platform, event_type, outcome, detail, message_id, received_at";
const hitList = HIT_OUTCOMES.map((o) => `'${o}'`).join(",");

export async function listEvents(db: D1Database, filter: EventFilter): Promise<EventPage> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.before) {
    where.push("id < ?");
    params.push(filter.before);
  }
  if (filter.accountId) {
    where.push("account_id = ?");
    params.push(filter.accountId);
  }
  if (filter.outcome) {
    where.push("outcome = ?");
    params.push(filter.outcome);
  } else if (filter.hit !== undefined) {
    where.push(`outcome ${filter.hit ? "" : "NOT "}IN (${hitList})`);
  }
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM webhook_events ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY id DESC LIMIT ?`,
    )
    .bind(...params, filter.limit + 1)
    .all<EventRow>();
  const page = results.slice(0, filter.limit);
  return {
    events: page.map(toEvent),
    nextCursor: results.length > filter.limit ? page[page.length - 1].id : null,
  };
}

export async function getEvent(db: D1Database, id: number): Promise<WebhookEventDetail | null> {
  const row = await db.prepare(`SELECT ${COLUMNS}, raw FROM webhook_events WHERE id = ?`).bind(id).first<EventRow>();
  return row ? { ...toEvent(row), raw: row.raw ?? "" } : null;
}

export async function eventStats(db: D1Database, sinceHours: number): Promise<EventStats> {
  const { results } = await db
    .prepare("SELECT outcome, COUNT(*) AS count FROM webhook_events WHERE received_at >= ? GROUP BY outcome")
    .bind(Date.now() - sinceHours * 3600_000)
    .all<{ outcome: EventOutcome; count: number }>();
  const byOutcome = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<EventOutcome, number>;
  let total = 0;
  for (const r of results) {
    if (r.outcome in byOutcome) byOutcome[r.outcome] = r.count;
    total += r.count;
  }
  return { sinceHours, total, byOutcome };
}

export async function pruneEvents(db: D1Database) {
  await db
    .prepare("DELETE FROM webhook_events WHERE received_at < ?")
    .bind(Date.now() - EVENT_RETENTION_DAYS * 86400_000)
    .run();
}
