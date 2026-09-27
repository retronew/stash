import type { AttachmentStatus, ChatType, MediaStats, Message, MessagePage, Platform } from "@stash/shared";
import { toAttachment, type AttachmentRow } from "#media/attachments";
import { inClause } from "#params";

interface MessageRow {
  id: number;
  account_id: string;
  platform: Platform;
  chat_type: ChatType;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  sent_at: number;
  received_at: number;
}

export interface MessageFilter {
  /** Only messages with a smaller id (the previous page's nextCursor). */
  before?: number;
  limit: number;
  accountIds?: string[];
  chatTypes?: ChatType[];
  /** Only messages with at least one attachment. */
  withMedia?: boolean;
  /** Text or sender name contains this (case-insensitive for ASCII). */
  query?: string;
  /** sent_at range, ms. */
  since?: number;
  until?: number;
  /** Only messages with an attachment in this state. */
  status?: AttachmentStatus;
}

// Newest first by id (arrival order): a stable cursor even when two
// messages share a timestamp.
export async function listMessages(db: D1Database, filter: MessageFilter): Promise<MessagePage> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.before) {
    where.push("m.id < ?");
    params.push(filter.before);
  }
  if (filter.accountIds?.length) where.push(inClause("m.account_id", filter.accountIds, params));
  if (filter.chatTypes?.length) where.push(inClause("m.chat_type", filter.chatTypes, params));
  if (filter.query) {
    // "!" escapes LIKE's wildcards, so a search for "50%" means the text "50%".
    where.push("(m.text LIKE ? ESCAPE '!' OR m.sender_name LIKE ? ESCAPE '!')");
    const like = `%${filter.query.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
    params.push(like, like);
  }
  if (filter.since) {
    where.push("m.sent_at >= ?");
    params.push(filter.since);
  }
  if (filter.until) {
    where.push("m.sent_at < ?");
    params.push(filter.until);
  }
  if (filter.status) {
    where.push("EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id AND a.status = ?)");
    params.push(filter.status);
  } else if (filter.withMedia) {
    where.push("EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id)");
  }
  const sql = `SELECT m.id, m.account_id, m.platform, m.chat_type, m.chat_id, m.sender_id, m.sender_name, m.text,
      m.sent_at, m.received_at
    FROM messages m ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY m.id DESC LIMIT ?`;
  // One extra row tells whether there is a next page.
  const { results: rows } = await db
    .prepare(sql)
    .bind(...params, filter.limit + 1)
    .all<MessageRow>();
  const page = rows.slice(0, filter.limit);
  const attachments = await attachmentsOf(db, page.map((r) => r.id));
  return {
    messages: page.map((r) => toMessage(r, attachments.get(r.id) ?? [])),
    nextCursor: rows.length > filter.limit ? page[page.length - 1].id : null,
  };
}

async function attachmentsOf(db: D1Database, messageIds: number[]): Promise<Map<number, AttachmentRow[]>> {
  const out = new Map<number, AttachmentRow[]>();
  if (messageIds.length === 0) return out;
  const { results } = await db
    .prepare(`SELECT * FROM attachments WHERE message_id IN (${messageIds.map(() => "?").join(",")}) ORDER BY idx`)
    .bind(...messageIds)
    .all<AttachmentRow>();
  for (const row of results) {
    const list = out.get(row.message_id) ?? [];
    list.push(row);
    out.set(row.message_id, list);
  }
  return out;
}

/** One message with its attachments, or null. */
export async function getMessage(db: D1Database, id: number): Promise<Message | null> {
  const row = await db
    .prepare(
      `SELECT id, account_id, platform, chat_type, chat_id, sender_id, sender_name, text, sent_at, received_at
       FROM messages WHERE id = ?`,
    )
    .bind(id)
    .first<MessageRow>();
  if (!row) return null;
  return toMessage(row, (await attachmentsOf(db, [id])).get(id) ?? []);
}

function toMessage(row: MessageRow, attachments: AttachmentRow[]): Message {
  return {
    id: row.id,
    accountId: row.account_id,
    platform: row.platform,
    chatType: row.chat_type,
    chatId: row.chat_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    attachments: attachments.map(toAttachment),
  };
}

/** Deletes a message, its attachment rows and their files in R2. False if it didn't exist. */
export async function deleteMessage(db: D1Database, bucket: R2Bucket, id: number): Promise<boolean> {
  const { results } = await db
    .prepare("SELECT r2_key FROM attachments WHERE message_id = ? AND r2_key IS NOT NULL")
    .bind(id)
    .all<{ r2_key: string }>();
  if (results.length) await bucket.delete(results.map((r) => r.r2_key));
  const res = await db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  return res.meta.changes > 0;
}

export async function mediaStats(db: D1Database): Promise<MediaStats> {
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS count, COALESCE(SUM(stored_size), 0) AS bytes FROM attachments GROUP BY status")
    .all<{ status: AttachmentStatus; count: number; bytes: number }>();
  const stats: MediaStats = { pending: 0, downloading: 0, stored: 0, failed: 0, storedBytes: 0 };
  for (const r of results) {
    if (r.status in stats) stats[r.status] = r.count;
    if (r.status === "stored") stats.storedBytes = r.bytes;
  }
  return stats;
}
