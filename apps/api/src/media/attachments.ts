import type { Attachment, AttachmentKind, AttachmentStatus } from "@stash/shared";

export interface AttachmentRow {
  id: number;
  message_id: number;
  idx: number;
  kind: AttachmentKind;
  source_url: string;
  filename: string;
  content_type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  status: AttachmentStatus;
  r2_key: string | null;
  stored_size: number | null;
  attempts: number;
  last_error: string;
  next_retry_at: number | null;
  stored_at: number | null;
  created_at: number;
  updated_at: number;
}

export function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    kind: row.kind,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    width: row.width,
    height: row.height,
    status: row.status,
    storedSize: row.stored_size,
    attempts: row.attempts,
    lastError: row.last_error,
    storedAt: row.stored_at,
  };
}

/** The attachment with what a download needs from its message. */
export interface DownloadTarget extends AttachmentRow {
  platform: string;
  received_at: number;
}

/**
 * Takes the attachment for one download attempt. Null when it is stored,
 * being downloaded by another consumer, or gone — the queue message is then
 * a duplicate and can be dropped.
 */
export async function claim(db: D1Database, id: number): Promise<DownloadTarget | null> {
  const now = Date.now();
  const claimed = await db
    .prepare(
      `UPDATE attachments SET status = 'downloading', attempts = attempts + 1, next_retry_at = NULL, updated_at = ?
       WHERE id = ? AND status IN ('pending', 'failed') RETURNING id`,
    )
    .bind(now, id)
    .first<{ id: number }>();
  if (!claimed) return null;
  return db
    .prepare(
      `SELECT a.*, m.platform, m.received_at FROM attachments a JOIN messages m ON m.id = a.message_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<DownloadTarget>();
}

export async function markStored(
  db: D1Database,
  id: number,
  stored: { key: string; size: number; contentType: string },
) {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE attachments SET status = 'stored', r2_key = ?, stored_size = ?,
         content_type = CASE WHEN content_type = '' THEN ? ELSE content_type END,
         last_error = '', stored_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(stored.key, stored.size, stored.contentType, now, now, id)
    .run();
}

/** Back to pending until the queued retry is due. */
export async function markRetrying(db: D1Database, id: number, error: string, delaySeconds: number) {
  const now = Date.now();
  await db
    .prepare(`UPDATE attachments SET status = 'pending', last_error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?`)
    .bind(error.slice(0, 500), now + delaySeconds * 1000, now, id)
    .run();
}

export async function markFailed(db: D1Database, id: number, error: string) {
  await db
    .prepare(`UPDATE attachments SET status = 'failed', last_error = ?, next_retry_at = NULL, updated_at = ? WHERE id = ? AND status != 'stored'`)
    .bind(error.slice(0, 500), Date.now(), id)
    .run();
}

/** Manual retry: a fresh set of attempts. Returns the ids that were reset. */
export async function resetForRetry(db: D1Database, ids: number[] | "failed"): Promise<number[]> {
  const now = Date.now();
  const where = ids === "failed" ? "status = 'failed'" : `status = 'failed' AND id IN (${ids.map(() => "?").join(",") || "NULL"})`;
  const { results } = await db
    .prepare(`UPDATE attachments SET status = 'pending', attempts = 0, next_retry_at = NULL, updated_at = ? WHERE ${where} RETURNING id`)
    .bind(now, ...(ids === "failed" ? [] : ids))
    .all<{ id: number }>();
  return results.map((r) => r.id);
}
