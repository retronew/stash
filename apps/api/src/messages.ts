import {
  emptyFields,
  FIELD_KEYS,
  type AnalysisStatus,
  type AttachmentStatus,
  type ChatSummary,
  type ChatType,
  type MediaStats,
  type Message,
  type MessageFields,
  type MessagePage,
  type Platform,
} from "@stash/shared";
import { toAttachment, type AttachmentRow } from "#media/attachments";
import { inClause } from "#params";
import { derivedKeys } from "#media/thumbs";

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
  category: string;
  tags: string;
  summary: string;
  ocr_text: string;
  fields: string;
  ai_status: AnalysisStatus;
  ai_error: string;
  deleted_at: number | null;
}

/** Columns of a message for display (everything but the raw payload and vectors). */
export function messageColumns(alias = "m"): string {
  return [
    "id", "account_id", "platform", "chat_type", "chat_id", "sender_id", "sender_name", "text", "sent_at",
    "received_at", "category", "tags", "summary", "ocr_text", "fields", "ai_status", "ai_error", "deleted_at",
  ]
    .map((c) => `${alias}.${c}`)
    .join(", ");
}

/** Which messages: every field optional, lists match any of their values. */
export interface MessageQuery {
  platforms?: Platform[];
  accountIds?: string[];
  chatTypes?: ChatType[];
  /** Specific conversations (chat ids). */
  chatIds?: string[];
  /** Any of these categories ("" = not categorized). */
  categories?: string[];
  /** Any of these tags. */
  tags?: string[];
  /** Only messages with at least one attachment. */
  withMedia?: boolean;
  /** Text or sender name contains this (case-insensitive for ASCII). */
  query?: string;
  /** sent_at range, ms: since inclusive, until exclusive. */
  since?: number;
  until?: number;
  /** Only messages with an attachment in this state. */
  status?: AttachmentStatus;
  /** The recycle bin instead of the live messages. */
  trash?: boolean;
}

export interface MessageFilter extends MessageQuery {
  /** Only messages with a smaller id (the previous page's nextCursor). */
  before?: number;
  limit: number;
}

/** WHERE conditions on `messages m` for a query; pushes their values onto `params`. */
export function messageWhere(q: MessageQuery, params: unknown[]): string[] {
  const where: string[] = [q.trash ? "m.deleted_at IS NOT NULL" : "m.deleted_at IS NULL"];
  if (q.platforms?.length) where.push(inClause("m.platform", q.platforms, params));
  if (q.accountIds?.length) where.push(inClause("m.account_id", q.accountIds, params));
  if (q.chatTypes?.length) where.push(inClause("m.chat_type", q.chatTypes, params));
  if (q.chatIds?.length) where.push(inClause("m.chat_id", q.chatIds, params));
  if (q.categories?.length) where.push(inClause("m.category", q.categories, params));
  if (q.tags?.length) where.push(`EXISTS (SELECT 1 FROM json_each(m.tags) t WHERE ${inClause("t.value", q.tags, params)})`);
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
  const sql = `SELECT ${messageColumns()}
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
      `SELECT ${messageColumns()} FROM messages m WHERE m.id = ?`,
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
    category: row.category,
    tags: parseTags(row.tags),
    summary: row.summary,
    ocrText: row.ocr_text,
    fields: parseFields(row.fields),
    aiStatus: row.ai_status,
    aiError: row.ai_error,
    deletedAt: row.deleted_at,
  };
}

export function parseTags(json: string): string[] {
  try {
    const list: unknown = JSON.parse(json || "[]");
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function parseFields(json: string): MessageFields {
  const out = emptyFields();
  try {
    const raw = JSON.parse(json || "{}") as Record<string, unknown>;
    for (const key of FIELD_KEYS) {
      const list = raw[key];
      if (Array.isArray(list)) out[key] = list.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Corrupt: no fields.
  }
  return out;
}

/** Messages by id, in the order given (missing ids are skipped). */
export async function messagesByIds(db: D1Database, ids: number[]): Promise<Message[]> {
  if (ids.length === 0) return [];
  const { results } = await db
    .prepare(`SELECT ${messageColumns()} FROM messages m WHERE m.id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<MessageRow>();
  const attachments = await attachmentsOf(db, ids);
  const byId = new Map(results.map((r) => [r.id, toMessage(r, attachments.get(r.id) ?? [])]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Sets category and / or tags by hand. */
export async function updateMessageLabels(db: D1Database, id: number, labels: { category?: string; tags?: string[] }) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (labels.category !== undefined) {
    sets.push("category = ?");
    params.push(labels.category.trim().slice(0, 50));
  }
  if (labels.tags !== undefined) {
    sets.push("tags = ?");
    params.push(JSON.stringify([...new Set(labels.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 10)));
  }
  if (!sets.length) return false;
  const res = await db.prepare(`UPDATE messages SET ${sets.join(", ")} WHERE id = ?`).bind(...params, id).run();
  return res.meta.changes > 0;
}

/** D1 binds at most 100 values per statement: runs `fn` over chunks of ids and sums the counts. */
async function inChunks(ids: number[], size: number, fn: (chunk: number[]) => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += size) total += await fn(ids.slice(i, i + size));
  return total;
}

/** Sets one category on many messages; returns how many. */
export async function setCategory(db: D1Database, ids: number[], category: string): Promise<number> {
  return inChunks(ids, 90, async (chunk) => {
    // RETURNING, not meta.changes: the full-text triggers' writes count there too.
    const { results } = await db
      .prepare(`UPDATE messages SET category = ? WHERE id IN (${chunk.map(() => "?").join(",")}) RETURNING id`)
      .bind(category.trim().slice(0, 50), ...chunk)
      .all();
    return results.length;
  });
}

/** Adds or removes tags on many messages (at most 10 tags each); returns how many changed. */
export async function editTags(db: D1Database, ids: number[], tags: string[], mode: "add" | "remove"): Promise<number> {
  const wanted = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (wanted.length === 0) return 0;
  return inChunks(ids, 90, (chunk) => editTagsChunk(db, chunk, wanted, mode));
}

async function editTagsChunk(db: D1Database, ids: number[], wanted: string[], mode: "add" | "remove"): Promise<number> {
  const { results } = await db
    .prepare(`SELECT id, tags FROM messages WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ id: number; tags: string }>();
  const writes = results.flatMap((r) => {
    const before = parseTags(r.tags);
    const after =
      mode === "add" ? [...new Set([...before, ...wanted])].slice(0, 10) : before.filter((t) => !wanted.includes(t));
    if (JSON.stringify(after) === JSON.stringify(before)) return [];
    return [db.prepare("UPDATE messages SET tags = ? WHERE id = ?").bind(JSON.stringify(after), r.id)];
  });
  if (writes.length) await db.batch(writes);
  return writes.length;
}

/** Categories in use, with counts, most used first. */
export async function categoryCounts(db: D1Database): Promise<{ category: string; count: number }[]> {
  const { results } = await db
    .prepare("SELECT category, COUNT(*) AS count FROM messages WHERE category != '' AND deleted_at IS NULL GROUP BY category ORDER BY count DESC")
    .all<{ category: string; count: number }>();
  return results;
}

/** Tags in use, with counts, most used first. */
export async function tagCounts(db: D1Database): Promise<{ tag: string; count: number }[]> {
  const { results } = await db
    .prepare(
      "SELECT t.value AS tag, COUNT(*) AS count FROM messages m, json_each(m.tags) t WHERE m.deleted_at IS NULL GROUP BY t.value ORDER BY count DESC LIMIT 200",
    )
    .all<{ tag: string; count: number }>();
  return results;
}

/** Moves messages to the recycle bin; returns how many were live. */
export async function trashMessages(db: D1Database, ids: number[]): Promise<number> {
  const now = Date.now();
  return inChunks(ids, 90, async (chunk) => {
    const res = await db
      .prepare(`UPDATE messages SET deleted_at = ? WHERE deleted_at IS NULL AND id IN (${chunk.map(() => "?").join(",")})`)
      .bind(now, ...chunk)
      .run();
    return res.meta.changes ?? 0;
  });
}

/** Takes messages back out of the recycle bin; returns how many. */
export async function restoreMessages(db: D1Database, ids: number[]): Promise<number> {
  return inChunks(ids, 90, async (chunk) => {
    const res = await db
      .prepare(`UPDATE messages SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND id IN (${chunk.map(() => "?").join(",")})`)
      .bind(...chunk)
      .run();
    return res.meta.changes ?? 0;
  });
}

/** R2 deletes at most 1000 keys per call; D1 binds at most 100 values. */
const PURGE_CHUNK = 100;

/**
 * Deletes messages in the recycle bin for good: rows (attachments cascade)
 * and their files in R2. Live messages are left alone. Returns how many.
 */
export async function purgeMessages(db: D1Database, bucket: R2Bucket, ids: number[]): Promise<number> {
  let purged = 0;
  for (let i = 0; i < ids.length; i += PURGE_CHUNK) {
    const chunk = ids.slice(i, i + PURGE_CHUNK);
    const list = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT a.id, a.r2_key, a.kind FROM attachments a JOIN messages m ON m.id = a.message_id
         WHERE m.deleted_at IS NOT NULL AND m.id IN (${list}) AND a.r2_key IS NOT NULL`,
      )
      .bind(...chunk)
      .all<{ id: number; r2_key: string; kind: string }>();
    // Files first: a row without its file is harmless, a file without its row is lost space.
    const keys = results.flatMap((r) => (r.kind === "image" ? [r.r2_key, ...derivedKeys(r.id)] : [r.r2_key]));
    if (keys.length) await bucket.delete(keys);
    const res = await db.prepare(`DELETE FROM messages WHERE deleted_at IS NOT NULL AND id IN (${list})`).bind(...chunk).run();
    purged += res.meta.changes ?? 0;
  }
  return purged;
}

/** Ids in the recycle bin, optionally only those deleted before a time. */
export async function trashedIds(db: D1Database, before?: number, limit = 1000): Promise<number[]> {
  const { results } = await db
    .prepare(`SELECT id FROM messages WHERE deleted_at IS NOT NULL AND deleted_at < ? ORDER BY deleted_at LIMIT ?`)
    .bind(before ?? Number.MAX_SAFE_INTEGER, limit)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

/** Every conversation with its message count, most recent first. */
export async function listChats(db: D1Database): Promise<ChatSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT account_id AS accountId, platform, chat_type AS chatType, chat_id AS chatId,
         COUNT(*) AS messages, MAX(sent_at) AS lastAt,
         -- A direct chat is named after the person; groups have no name in the payload.
         MAX(CASE WHEN chat_type IN ('c2c', 'dm') THEN sender_name ELSE '' END) AS name
       FROM messages WHERE chat_id != '' AND deleted_at IS NULL
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
