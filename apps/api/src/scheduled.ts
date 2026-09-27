import type { Env } from "#types";
import { sweepMedia, sweepThumbs } from "#media/sweep";
import { pruneAll } from "#retention";

/** Cron trigger entry point; the schedule lives in wrangler.jsonc. */
export async function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(Promise.all([sweepMedia(env), sweepThumbs(env), pruneAll(env.DB, env.MEDIA)]));
}
