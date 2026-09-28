import type { Env } from "#types";
import { analyzeMessage, FilesPendingError, NotConfiguredError } from "#analysis/run";
import { NoJsonError } from "#analysis/parse";
import { getAnalysisSettings } from "#analysis/settings";
import { nextDelaySeconds } from "#media/retry";
import { describeError } from "#ai";

// Queue handling of one "analyze" job, like downloads:
//   pending -> (claim) -> running -> done | skipped
//                            +-> pending again with backoff, or failed after the last attempt
// Over the daily limit, the job waits for the next UTC day.
// Cancelling (queue.ts) takes a row out of pending/running; every write here
// requires the state it expects, so a cancelled job's result is dropped.

const INFRA_RETRY_SECONDS = 60;
const DAY_MS = 86_400_000;
/** Queue messages can be delayed by at most 12 hours. */
const MAX_DELAY_SECONDS = 12 * 3600;
/**
 * A reply without JSON is usually the model declining (e.g. its content
 * policy), which asking again won't change: one more try for a garbled
 * reply, then failed.
 */
const NO_JSON_ATTEMPTS = 2;

export async function processAnalyzeJob(message: Message<unknown>, env: Env, messageId: number) {
  const now = Date.now();
  let attempts: number;
  try {
    const settings = await getAnalysisSettings(env.DB);
    if (settings.dailyLimit > 0) {
      const dayStart = now - (now % DAY_MS);
      const done = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE ai_at >= ?")
        .bind(dayStart)
        .first<{ n: number }>();
      if ((done?.n ?? 0) >= settings.dailyLimit) {
        const wait = Math.min(Math.ceil((dayStart + DAY_MS - now) / 1000) + 60, MAX_DELAY_SECONDS);
        await env.DB.prepare("UPDATE messages SET ai_next_retry_at = ?, ai_updated_at = ? WHERE id = ? AND ai_status = 'pending'")
          .bind(now + wait * 1000, now, messageId)
          .run();
        message.retry({ delaySeconds: wait });
        return;
      }
    }
    const claimed = await env.DB.prepare(
      `UPDATE messages SET ai_status = 'running', ai_attempts = ai_attempts + 1, ai_next_retry_at = NULL, ai_updated_at = ?
       WHERE id = ? AND ai_status = 'pending' RETURNING ai_attempts`,
    )
      .bind(now, messageId)
      .first<{ ai_attempts: number }>();
    // Done already, running elsewhere, or reset by hand: a duplicate.
    if (!claimed) {
      message.ack();
      return;
    }
    attempts = claimed.ai_attempts;
  } catch (err) {
    console.error("analysis claim failed", messageId, err);
    message.retry({ delaySeconds: INFRA_RETRY_SECONDS });
    return;
  }

  try {
    const outcome = await analyzeMessage(env, messageId);
    await env.DB.prepare("UPDATE messages SET ai_status = ?, ai_error = '', ai_at = ?, ai_updated_at = ? WHERE id = ? AND ai_status = 'running'")
      .bind(outcome, Date.now(), Date.now(), messageId)
      .run();
    message.ack();
  } catch (err) {
    const error = describeError(err).slice(0, 500);
    try {
      if (err instanceof NotConfiguredError || err instanceof FilesPendingError) {
        // Not now: once AI is set up ("analyze all"), or once the files are in (analyzeWhenReady).
        await env.DB.prepare("UPDATE messages SET ai_status = '', ai_error = ?, ai_updated_at = ? WHERE id = ? AND ai_status = 'running'")
          .bind(error, Date.now(), messageId)
          .run();
        message.ack();
        return;
      }
      const delay = err instanceof NoJsonError && attempts >= NO_JSON_ATTEMPTS ? null : nextDelaySeconds(attempts);
      console.warn("analysis failed", { messageId, attempts, error, retryIn: delay });
      if (delay === null) {
        await env.DB.prepare("UPDATE messages SET ai_status = 'failed', ai_error = ?, ai_updated_at = ? WHERE id = ? AND ai_status = 'running'")
          .bind(error, Date.now(), messageId)
          .run();
        message.ack();
      } else {
        const { meta } = await env.DB.prepare(
          "UPDATE messages SET ai_status = 'pending', ai_error = ?, ai_next_retry_at = ?, ai_updated_at = ? WHERE id = ? AND ai_status = 'running'",
        )
          .bind(error, Date.now() + delay * 1000, Date.now(), messageId)
          .run();
        // Cancelled meanwhile: nothing to retry.
        if (meta.changes === 0) message.ack();
        else message.retry({ delaySeconds: delay });
      }
    } catch (dbErr) {
      console.error("recording the analysis failure failed", messageId, dbErr);
      message.retry({ delaySeconds: INFRA_RETRY_SECONDS });
    }
  }
}
