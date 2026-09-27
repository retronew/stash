import type { AttachmentKind, AttachmentStatus, MediaTask, MediaTaskDetail, MediaTaskPage, Platform } from "@stash/shared";
import { toAttachment, type AttachmentRow } from "#media/attachments";

// Attachments as download tasks, joined with their message, for the task queue page.

interface TaskRow extends AttachmentRow {
  account_id: string;
  platform: Platform;
  sender_name: string;
  text: string;
}

const TEXT_PREVIEW = 80;

function toTask(row: TaskRow): MediaTask {
  return {
    ...toAttachment(row),
    messageId: row.message_id,
    accountId: row.account_id,
    platform: row.platform,
    senderName: row.sender_name,
    text: row.text.length > TEXT_PREVIEW ? `${row.text.slice(0, TEXT_PREVIEW)}…` : row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextRetryAt: row.next_retry_at,
  };
}

const SELECT = `SELECT a.*, m.account_id, m.platform, m.sender_name, m.text
  FROM attachments a JOIN messages m ON m.id = a.message_id`;

export interface TaskFilter {
  before?: number;
  limit: number;
  status?: AttachmentStatus;
  kind?: AttachmentKind;
  accountId?: string;
}

/** Newest first; a stable id cursor. */
export async function listTasks(db: D1Database, filter: TaskFilter): Promise<MediaTaskPage> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.before) {
    where.push("a.id < ?");
    params.push(filter.before);
  }
  if (filter.status) {
    where.push("a.status = ?");
    params.push(filter.status);
  }
  if (filter.kind) {
    where.push("a.kind = ?");
    params.push(filter.kind);
  }
  if (filter.accountId) {
    where.push("m.account_id = ?");
    params.push(filter.accountId);
  }
  const { results } = await db
    .prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.id DESC LIMIT ?`)
    .bind(...params, filter.limit + 1)
    .all<TaskRow>();
  const page = results.slice(0, filter.limit);
  return {
    tasks: page.map(toTask),
    nextCursor: results.length > filter.limit ? page[page.length - 1].id : null,
  };
}

export async function getTask(db: D1Database, id: number): Promise<MediaTaskDetail | null> {
  const row = await db.prepare(`${SELECT} WHERE a.id = ?`).bind(id).first<TaskRow>();
  if (!row) return null;
  return { ...toTask(row), text: row.text, sourceUrl: row.source_url, r2Key: row.r2_key };
}
