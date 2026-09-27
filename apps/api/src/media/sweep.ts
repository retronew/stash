import type { Env } from "#types";
import { enqueueDownloads, enqueueJobs } from "#media/jobs";
import { MAX_ATTEMPTS } from "#media/retry";
import { imagesWithoutThumbs } from "#media/thumbs";

// Safety net, run by the cron trigger. Queues deliver at least once, but two
// things can still strand an attachment: the enqueue after ingest failed, or
// a consumer died mid-download (the row is stuck in "downloading").

/** A consumer runs at most 15 minutes; a download older than this died with it. */
const STUCK_MS = 20 * 60_000;
/** How long a pending row may sit (past its retry time) before we assume its queue message is lost. */
const LOST_MS = 15 * 60_000;
const BATCH = 200;

/** Older images get thumbnails a few at a time, so the monthly Images quota isn't spent in one go. */
const THUMB_BACKFILL = 20;

/** Queues thumbnails for stored images that have none yet. */
export async function sweepThumbs(env: Env) {
  const ids = await imagesWithoutThumbs(env, THUMB_BACKFILL);
  if (ids.length) await enqueueJobs(env, ids.map((attachmentId) => ({ kind: "thumb" as const, attachmentId })));
}

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
  if (results.length === 0) {
    await sweepAnalysis(env, now);
    return;
  }
  const ids = results.map((r) => r.id);
  // Restart the clock so the next sweep doesn't queue them again right away.
  await env.DB.prepare(`UPDATE attachments SET updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(now, ...ids)
    .run();
  await enqueueDownloads(env, ids);
  console.log("sweep re-queued", ids.length);
  await sweepAnalysis(env, now);
}

/** The same for analyses: interrupted ones back to pending, lost ones queued again. */
async function sweepAnalysis(env: Env, now: number) {
  await env.DB.prepare(
    `UPDATE messages SET ai_status = 'pending', ai_error = 'analysis interrupted', ai_updated_at = ?
     WHERE ai_status = 'running' AND ai_updated_at < ?`,
  )
    .bind(now, now - STUCK_MS)
    .run();
  const { results } = await env.DB.prepare(
    `SELECT id FROM messages WHERE ai_status = 'pending' AND COALESCE(ai_next_retry_at, ai_updated_at) < ? ORDER BY id LIMIT ?`,
  )
    .bind(now - LOST_MS, BATCH)
    .all<{ id: number }>();
  if (results.length === 0) return;
  const ids = results.map((r) => r.id);
  await env.DB.prepare(`UPDATE messages SET ai_updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(now, ...ids)
    .run();
  await enqueueJobs(env, ids.map((messageId) => ({ kind: "analyze" as const, messageId })));
  console.log("sweep re-queued analyses", ids.length);
}
