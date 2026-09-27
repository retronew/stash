import type { AttachmentKind, ExportSummary } from "@stash/shared";
import { messageWhere, type MessageQuery } from "#messages";
import { inClause } from "#params";

// What an export would contain. The files themselves are listed through
// /api/messages (same filters) and zipped in the browser: CRC32 over
// gigabytes doesn't fit a Worker's CPU limit.

export async function exportSummary(db: D1Database, query: MessageQuery, kinds: AttachmentKind[]): Promise<ExportSummary> {
  const msgParams: unknown[] = [];
  const msgWhere = messageWhere(query, msgParams);
  const fileParams = [...msgParams];
  const fileWhere = kinds.length ? [...msgWhere, inClause("a.kind", kinds, fileParams)] : msgWhere;
  const where = (conditions: string[]) => (conditions.length ? `WHERE ${conditions.join(" AND ")}` : "");

  const [messages, files] = await db.batch<{ count: number; status?: string; bytes?: number }>([
    db.prepare(`SELECT COUNT(*) AS count FROM messages m ${where(msgWhere)}`).bind(...msgParams),
    db
      .prepare(
        `SELECT a.status AS status, COUNT(*) AS count, COALESCE(SUM(a.stored_size), 0) AS bytes
         FROM attachments a JOIN messages m ON m.id = a.message_id ${where(fileWhere)}
         GROUP BY a.status`,
      )
      .bind(...fileParams),
  ]);
  let stored = 0;
  let bytes = 0;
  let unsaved = 0;
  for (const row of files.results) {
    if (row.status === "stored") {
      stored = row.count;
      bytes = row.bytes ?? 0;
    } else {
      unsaved += row.count;
    }
  }
  return { messages: messages.results[0]?.count ?? 0, files: stored, bytes, unsaved };
}
