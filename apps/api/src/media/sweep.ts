import type { Env } from "#types";
import { enqueueDownloads, enqueueJobs } from "#media/jobs";
import { MAX_ATTEMPTS } from "#media/retry";
import { imagesWithoutThumbs } from "#media/thumbs";

// Safety nets, run by the scheduled tasks (cron-tasks.ts). Queues deliver at
// least once, but two things can still strand work: the enqueue after ingest
// failed, or a consumer died mid-job (the row is stuck in "downloading" /
// "running"). Each returns how many it queued again.

/** A consumer runs at most 15 minutes; a job older than this died with it. */
const STUCK_MS = 20 * 60_000;
/** How long a pending row may sit (past its retry time) before we assume its queue message is lost. */
const LOST_MS = 15 * 60_000;
/** Per run; D1 binds at most 100 values per statement. */
const BATCH = 90;

/** Older images get thumbnails a few at a time, so the monthly Images quota isn't spent in one go. */
const THUMB_BACKFILL = 20;

/** Queues thumbnails for stored images that have none yet. */
export async function sweepThumbs(env: Env): Promise<number> {
  const ids = await imagesWithoutThumbs(env, THUMB_BACKFILL);
  if (ids.length) await enqueueJobs(env, ids.map((attachmentId) => ({ kind: "thumb" as const, attachmentId })));
  return ids.length;
}

/** Stored files without a hash yet (from before hashing existed), a batch at a time. */
export async function sweepHashes(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM attachments WHERE status = 'stored' AND content_hash IS NULL ORDER BY id LIMIT ?`,
  )
    .bind(BATCH)
    .all<{ id: number }>();
  if (results.length) await enqueueJobs(env, results.map((r) => ({ kind: "hash" as const, attachmentId: r.id })));
  return results.length;
}

/** Interrupted downloads back to pending (or failed after the last attempt), lost ones queued again. */
export async function sweepDownloads(env: Env): Promise<number> {
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
  if (results.length === 0) return 0;
  const ids = results.map((r) => r.id);
  // Restart the clock so the next sweep doesn't queue them again right away.
  await env.DB.prepare(`UPDATE attachments SET updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(now, ...ids)
    .run();
  await enqueueDownloads(env, ids);
  return ids.length;
}

/** The same for analyses. */
export async function sweepAnalysis(env: Env): Promise<number> {
  const now = Date.now();
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
  if (results.length === 0) return 0;
  const ids = results.map((r) => r.id);
  await env.DB.prepare(`UPDATE messages SET ai_updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(now, ...ids)
    .run();
  await enqueueJobs(env, ids.map((messageId) => ({ kind: "analyze" as const, messageId })));
  return ids.length;
}
