import type { Env } from "#types";
import { getAiSettings } from "#settings";
import { getAnalysisSettings } from "#analysis/settings";
import { enqueueJobs } from "#media/jobs";

// Queueing analyses. They share the media queue (job kind "analyze") and
// its retry and sweep machinery; see media/consumer.ts and media/sweep.ts.

const BATCH = 500;

/**
 * Marks messages pending and queues them. Running ones are left alone.
 * Returns the ids actually queued.
 */
export async function requestAnalysis(env: Env, ids: number[]): Promise<number[]> {
  const queued: number[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { results } = await env.DB.prepare(
      `UPDATE messages SET ai_status = 'pending', ai_attempts = 0, ai_error = '', ai_next_retry_at = NULL, ai_updated_at = ?
       WHERE id IN (${slice.map(() => "?").join(",")}) AND ai_status != 'running' RETURNING id`,
    )
      .bind(Date.now(), ...slice)
      .all<{ id: number }>();
    queued.push(...results.map((r) => r.id));
  }
  await enqueueJobs(env, queued.map((messageId) => ({ kind: "analyze", messageId })));
  return queued;
}

/**
 * After a message arrives or one of its downloads settles: once none of its
 * files is still pending, analyze it — if AI is set up and analysis is automatic.
 */
export async function analyzeWhenReady(env: Env, messageId: number) {
  try {
    const [ai, settings] = await Promise.all([getAiSettings(env.DB), getAnalysisSettings(env.DB)]);
    if (!ai || !settings.auto) return;
    const row = await env.DB.prepare(
      `SELECT m.ai_status,
         (SELECT COUNT(*) FROM attachments a WHERE a.message_id = m.id AND a.status IN ('pending', 'downloading')) AS waiting
       FROM messages m WHERE m.id = ?`,
    )
      .bind(messageId)
      .first<{ ai_status: string; waiting: number }>();
    if (!row || row.ai_status !== "" || row.waiting > 0) return;
    await requestAnalysis(env, [messageId]);
  } catch (err) {
    // Never fails the download or webhook; "analyze all" catches it up later.
    console.error("could not queue analysis", messageId, err);
  }
}

/**
 * Stops waiting and running analyses: back to "not analyzed". A queued job then
 * finds nothing to claim, and a running one's result is dropped (consumer.ts).
 * Returns the ids cancelled.
 */
export async function cancelAnalysis(env: Env, ids: number[]): Promise<number[]> {
  const cancelled: number[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { results } = await env.DB.prepare(
      `UPDATE messages SET ai_status = '', ai_error = 'cancelled', ai_next_retry_at = NULL, ai_updated_at = ?
       WHERE id IN (${slice.map(() => "?").join(",")}) AND ai_status IN ('pending', 'running') RETURNING id`,
    )
      .bind(Date.now(), ...slice)
      .all<{ id: number }>();
    cancelled.push(...results.map((r) => r.id));
  }
  return cancelled;
}

export type QueueScope = "unanalyzed" | "failed" | "all";

/** Queues many messages at once (at most `limit`), newest first. */
export async function queueByScope(env: Env, scope: QueueScope, limit = 1000): Promise<number> {
  const where =
    scope === "unanalyzed" ? "ai_status = ''" : scope === "failed" ? "ai_status = 'failed'" : "ai_status != 'running'";
  const { results } = await env.DB.prepare(`SELECT id FROM messages WHERE ${where} AND deleted_at IS NULL ORDER BY id DESC LIMIT ?`)
    .bind(limit)
    .all<{ id: number }>();
  return (await requestAnalysis(env, results.map((r) => r.id))).length;
}
