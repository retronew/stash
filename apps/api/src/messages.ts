import type { AttachmentStatus, ChatSummary, ChatType, MediaStats, Message, MessagePage, Platform } from "@stash/shared";
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

/** Which messages: every field optional, lists match any of their values. */
export interface MessageQuery {
  platforms?: Platform[];
  accountIds?: string[];
  chatTypes?: ChatType[];
  /** Specific conversations (chat ids). */
  chatIds?: string[];
  /** Only messages with at least one attachment. */
  withMedia?: boolean;
  /** Text or sender name contains this (case-insensitive for ASCII). */
  query?: string;
  /** sent_at range, ms: since inclusive, until exclusive. */
  since?: number;
  until?: number;
  /** Only messages with an attachment in this state. */
  status?: AttachmentStatus;
}

export interface MessageFilter extends MessageQuery {
  /** Only messages with a smaller id (the previous page's nextCursor). */
  before?: number;
  limit: number;
}

/** WHERE conditions on `messages m` for a query; pushes their values onto `params`. */
export function messageWhere(q: MessageQuery, params: unknown[]): string[] {
  const where: string[] = [];
  if (q.platforms?.length) where.push(inClause("m.platform", q.platforms, params));
  if (q.accountIds?.length) where.push(inClause("m.account_id", q.accountIds, params));
  if (q.chatTypes?.length) where.push(inClause("m.chat_type", q.chatTypes, params));
  if (q.chatIds?.length) where.push(inClause("m.chat_id", q.chatIds, params));
  if (q.query) {
    // "!" escapes LIKE's wildcards, so a search for "50%" means the text "50%".
    where.push("(m.text LIKE ? ESCAPE '!' OR m.sender_name LIKE ? ESCAPE '!')");
    const like = `%${q.query.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
    params.push(like, like);
  }
  if (q.since) {
    where.push("m.sent_at >= ?");
    params.push(q.since);
  }
  if (q.until) {
    where.push("m.sent_at < ?");
    params.push(q.until);
  }
  if (q.status) {
    where.push("EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id AND a.status = ?)");
    params.push(q.status);
  } else if (q.withMedia) {
    where.push("EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id)");
  }
  return where;
}

// Newest first by id (arrival order): a stable cursor even when two
// messages share a timestamp.
export async function listMessages(db: D1Database, filter: MessageFilter): Promise<MessagePage> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter.before) {
    where.push("m.id < ?");
    params.push(filter.before);
  }
  where.push(...messageWhere(filter, params));
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

/** Every conversation with its message count, most recent first. */
export async function listChats(db: D1Database): Promise<ChatSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT account_id AS accountId, platform, chat_type AS chatType, chat_id AS chatId,
         COUNT(*) AS messages, MAX(sent_at) AS lastAt,
         -- A direct chat is named after the person; groups have no name in the payload.
         MAX(CASE WHEN chat_type IN ('c2c', 'dm') THEN sender_name ELSE '' END) AS name
       FROM messages WHERE chat_id != ''
       GROUP BY account_id, platform, chat_type, chat_id
       ORDER BY lastAt DESC LIMIT 500`,
    )
    .all<ChatSummary>();
  return results;
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
