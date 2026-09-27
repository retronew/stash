import type { Env } from "#types";
import type { MediaJob } from "#media/jobs";
import { claim, markFailed, markRetrying, markStored, type DownloadTarget } from "#media/attachments";
import { downloadToR2 } from "#media/download";
import { DownloadError, nextDelaySeconds } from "#media/retry";

// Queue consumer: one attachment per message (max_batch_size 1 in wrangler.jsonc).
//
//   pending -> (claim) -> downloading -> stored
//      ^                      |
//      +-- queued retry ------+  retryable error, attempts left (backoff in retry.ts)
//                             +-> failed: gave up; can be retried by hand
//
// If D1 itself is down the message is simply retried; if the consumer dies
// mid-download, the sweep (media/sweep.ts) puts the row back to pending.

/** When D1 can't record the outcome, try the whole message again after this. */
const INFRA_RETRY_SECONDS = 60;

const DEAD_LETTER_QUEUE_SUFFIX = "-dlq";

export async function queue(batch: MessageBatch<MediaJob>, env: Env) {
  if (batch.queue.endsWith(DEAD_LETTER_QUEUE_SUFFIX)) {
    await deadLetters(batch, env);
    return;
  }
  for (const message of batch.messages) await processOne(message, env);
}

async function processOne(message: Message<MediaJob>, env: Env) {
  const id = message.body?.attachmentId;
  if (!Number.isInteger(id)) {
    message.ack();
    return;
  }

  let target: DownloadTarget | null;
  try {
    target = await claim(env.DB, id);
  } catch (err) {
    console.error("claim failed", id, err);
    message.retry({ delaySeconds: INFRA_RETRY_SECONDS });
    return;
  }
  // Stored already, or another consumer has it: this message is a duplicate.
  if (!target) {
    message.ack();
    return;
  }

  try {
    const stored = await downloadToR2(env.MEDIA, target);
    await markStored(env.DB, id, stored);
    message.ack();
  } catch (err) {
    const error = err instanceof DownloadError ? err : new DownloadError(String(err), true);
    const delay = error.retryable ? nextDelaySeconds(target.attempts) : null;
    console.warn("download failed", { id, attempts: target.attempts, error: error.message, retryIn: delay });
    try {
      if (delay === null) {
        await markFailed(env.DB, id, error.message);
        message.ack();
      } else {
        await markRetrying(env.DB, id, error.message, delay);
        message.retry({ delaySeconds: delay });
      }
    } catch (dbErr) {
      // The row stays "downloading"; this retry (or the sweep) picks it up again.
      console.error("recording the failure failed", id, dbErr);
      message.retry({ delaySeconds: INFRA_RETRY_SECONDS });
    }
  }
}

/** Messages the main queue gave up on (the consumer kept crashing): record them as failed. */
async function deadLetters(batch: MessageBatch<MediaJob>, env: Env) {
  for (const message of batch.messages) {
    const id = message.body?.attachmentId;
    if (Number.isInteger(id)) {
      try {
        await markFailed(env.DB, id, "gave up after repeated consumer errors");
      } catch (err) {
        console.error("dead letter not recorded", id, err);
        message.retry({ delaySeconds: INFRA_RETRY_SECONDS });
        continue;
      }
    }
    message.ack();
  }
}
