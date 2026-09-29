import type { Env } from "#types";

// The same file sent again: once every file of a new message is stored, and
// each one matches a file of an older message still in the list (and the text
// is empty or the same), the new message goes to the trash. Nothing is lost
// right away: it can be restored from there until the trash retention purges it.

/** Moves the message to the trash if it repeats an older one. Returns whether it did. */
export async function trashIfDuplicate(env: Env, messageId: number): Promise<boolean> {
  try {
    const { results: files } = await env.DB.prepare(`SELECT status, content_hash FROM attachments WHERE message_id = ?`)
      .bind(messageId)
      .all<{ status: string; content_hash: string | null }>();
    if (!files.length || files.some((f) => f.status !== "stored" || !f.content_hash)) return false;
    const hashes = [...new Set(files.map((f) => f.content_hash as string))];

    const original = await env.DB.prepare(
      `SELECT a.message_id FROM attachments a
         JOIN messages m ON m.id = a.message_id
         JOIN messages cur ON cur.id = ?
       WHERE a.content_hash IN (${hashes.map(() => "?").join(",")})
         AND a.status = 'stored' AND a.message_id < cur.id AND m.deleted_at IS NULL
         AND (TRIM(cur.text) = '' OR TRIM(cur.text) = TRIM(m.text))
       GROUP BY a.message_id
       HAVING COUNT(DISTINCT a.content_hash) = ?
       ORDER BY a.message_id LIMIT 1`,
    )
      .bind(messageId, ...hashes, hashes.length)
      .first<{ message_id: number }>();
    if (!original) return false;

    const { meta } = await env.DB.prepare(`UPDATE messages SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(Date.now(), messageId)
      .run();
    if (meta.changes) console.log("duplicate moved to trash", { messageId, of: original.message_id });
    return meta.changes > 0;
  } catch (err) {
    // Never fails the download; the message just stays.
    console.error("duplicate check failed", messageId, err);
    return false;
  }
}
