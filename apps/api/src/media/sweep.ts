import type { Env } from "#types";
import { enqueueDownloads } from "#media/jobs";
import { MAX_ATTEMPTS } from "#media/retry";

// Safety net, run by the cron trigger. Queues deliver at least once, but two
// things can still strand an attachment: the enqueue after ingest failed, or
// a consumer died mid-download (the row is stuck in "downloading").

/** A consumer runs at most 15 minutes; a download older than this died with it. */
const STUCK_MS = 20 * 60_000;
/** How long a pending row may sit (past its retry time) before we assume its queue message is lost. */
const LOST_MS = 15 * 60_000;
const BATCH = 200;

export async function sweepMedia(env: Env) {
  const now = Date.now();
  const stuckBefore = now - STUCK_MS;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE attachments SET status = 'failed', last_error = 'download interrupted', updated_at = ?
       WHERE status = 'downloading' AND updated_at < ? AND attempts >= ?`,
    ).bind(now, stuckBefore, MAX_ATTEMPTS),
    env.DB.prepare(
      `UPDATE attachments SET status = 'pending', last_error = 'download interrupted', updated_at = ?
       WHERE status = 'downloading' AND updated_at < ?`,
    ).bind(now, stuckBefore),
  ]);

  const { results } = await env.DB.prepare(
    `SELECT id FROM attachments WHERE status = 'pending' AND COALESCE(next_retry_at, updated_at) < ? ORDER BY id LIMIT ?`,
  )
    .bind(now - LOST_MS, BATCH)
    .all<{ id: number }>();
  if (results.length === 0) return;
  const ids = results.map((r) => r.id);
  // Restart the clock so the next sweep doesn't queue them again right away.
  await env.DB.prepare(`UPDATE attachments SET updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(now, ...ids)
    .run();
  await enqueueDownloads(env, ids);
  console.log("sweep re-queued", ids.length);
}
