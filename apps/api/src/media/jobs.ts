import type { Env } from "#types";

/** One queue message: download this attachment into R2. */
export interface MediaJob {
  attachmentId: number;
}

// sendBatch takes at most 100 messages.
const BATCH = 100;

/**
 * Queues downloads. Never throws: rows stay "pending" if this fails, and the
 * sweep (media/sweep.ts) queues them again later.
 */
export async function enqueueDownloads(env: Env, ids: number[]): Promise<boolean> {
  try {
    for (let i = 0; i < ids.length; i += BATCH) {
      await env.MEDIA_QUEUE.sendBatch(ids.slice(i, i + BATCH).map((attachmentId) => ({ body: { attachmentId } })));
    }
    return true;
  } catch (err) {
    console.error("enqueue failed; the sweep will retry", ids, err);
    return false;
  }
}
