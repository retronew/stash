import type { StatsSummary } from "@stash/shared";

// Numbers for the Stats page, as in PickIt: totals plus a few breakdowns.
// Live messages only (not the trash), except the trash count itself.

const DAY_MS = 86_400_000;

/**
 * `tzOffset` is the viewer's UTC offset in minutes (e.g. 480 for UTC+8), so
 * days and months break where the viewer's do.
 */
export async function stats(db: D1Database, tzOffset: number): Promise<StatsSummary> {
  const shift = `${tzOffset >= 0 ? "+" : "-"}${Math.abs(tzOffset)} minutes`;
  const since30 = Date.now() - 30 * DAY_MS;
  const live = "deleted_at IS NULL";
  const [totals, files, byDay, byMonth, byCategory, byBot, byChatType, byKind, topChats] = await db.batch<any>([
    db.prepare(
      `SELECT SUM(${live}) AS messages, SUM(deleted_at IS NOT NULL) AS trash,
         SUM(${live} AND ai_status = 'done') AS analyzed, SUM(${live} AND vec IS NOT NULL) AS embedded
       FROM messages`,
    ),
    db.prepare(
      `SELECT SUM(a.status = 'stored') AS stored, COALESCE(SUM(CASE WHEN a.status = 'stored' THEN a.stored_size END), 0) AS bytes,
         SUM(a.status = 'failed') AS failed
       FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.${live}`,
    ),
    db
      .prepare(
        `SELECT strftime('%Y-%m-%d', received_at / 1000, 'unixepoch', ?) AS day, COUNT(*) AS count
         FROM messages WHERE ${live} AND received_at >= ? GROUP BY day ORDER BY day`,
      )
      .bind(shift, since30),
    db
      .prepare(
        `SELECT strftime('%Y-%m', received_at / 1000, 'unixepoch', ?) AS month, COUNT(*) AS count
         FROM messages WHERE ${live} GROUP BY month ORDER BY month DESC LIMIT 12`,
      )
      .bind(shift),
    db.prepare(`SELECT category, COUNT(*) AS count FROM messages WHERE ${live} GROUP BY category ORDER BY count DESC LIMIT 20`),
    db.prepare(
      `SELECT m.account_id AS accountId, COALESCE(b.name, '') AS name, m.platform, COUNT(*) AS count
       FROM messages m LEFT JOIN bot_accounts b ON b.id = m.account_id WHERE m.${live}
       GROUP BY m.account_id ORDER BY count DESC`,
    ),
    db.prepare(`SELECT chat_type AS chatType, COUNT(*) AS count FROM messages WHERE ${live} GROUP BY chat_type ORDER BY count DESC`),
    db.prepare(
      `SELECT a.kind, COUNT(*) AS count, COALESCE(SUM(a.stored_size), 0) AS bytes
       FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.${live} AND a.status = 'stored'
       GROUP BY a.kind ORDER BY bytes DESC`,
    ),
    db.prepare(
      `SELECT account_id AS accountId, chat_type AS chatType, chat_id AS chatId, COUNT(*) AS count,
         MAX(CASE WHEN chat_type IN ('c2c', 'dm') THEN sender_name ELSE '' END) AS name
       FROM messages WHERE ${live} AND chat_id != '' GROUP BY account_id, chat_type, chat_id ORDER BY count DESC LIMIT 10`,
    ),
  ]);
  const t = totals.results[0] ?? {};
  const f = files.results[0] ?? {};
  return {
    messages: t.messages ?? 0,
    trash: t.trash ?? 0,
    analyzed: t.analyzed ?? 0,
    embedded: t.embedded ?? 0,
    files: f.stored ?? 0,
    bytes: f.bytes ?? 0,
    failedFiles: f.failed ?? 0,
    byDay: byDay.results,
    byMonth: [...byMonth.results].reverse(),
    byCategory: byCategory.results,
    byBot: byBot.results,
    byChatType: byChatType.results,
    byKind: byKind.results,
    topChats: topChats.results,
  };
}
