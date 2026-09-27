import type { Env } from "#types";

/**
 * One queue message: download an attachment into R2, or analyze a message
 * with AI, or rebuild vectors (see analysis/). Download jobs have no `kind`, as before analysis existed.
 */
export type MediaJob =
  | { attachmentId: number }
  | { kind: "analyze"; messageId: number }
  | { kind: "embed"; ids: number[] }
  | { kind: "thumb"; attachmentId: number };

export const isEmbedJob = (job: MediaJob): job is Extract<MediaJob, { kind: "embed" }> =>
  "kind" in job && job.kind === "embed";

export const isThumbJob = (job: MediaJob): job is Extract<MediaJob, { kind: "thumb" }> =>
  "kind" in job && job.kind === "thumb";

export const isAnalyzeJob = (job: MediaJob): job is Extract<MediaJob, { kind: "analyze" }> =>
  "kind" in job && job.kind === "analyze";

// sendBatch takes at most 100 messages.
const BATCH = 100;

/**
 * Queues jobs. Never throws: rows stay "pending" if this fails, and the
 * sweep (media/sweep.ts) queues them again later.
 */
export async function enqueueJobs(env: Env, jobs: MediaJob[]): Promise<boolean> {
  try {
    for (let i = 0; i < jobs.length; i += BATCH) {
      await env.MEDIA_QUEUE.sendBatch(jobs.slice(i, i + BATCH).map((body) => ({ body })));
    }
    return true;
  } catch (err) {
    console.error("enqueue failed; the sweep will retry", jobs.length, err);
    return false;
  }
}

/** Queues downloads of these attachments. */
export function enqueueDownloads(env: Env, ids: number[]): Promise<boolean> {
  return enqueueJobs(env, ids.map((attachmentId) => ({ attachmentId })));
}
