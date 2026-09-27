import type { Env } from "#types";
import { sweepMedia } from "#media/sweep";
import { pruneAll } from "#retention";

/** Cron trigger entry point; the schedule lives in wrangler.jsonc. */
export async function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(Promise.all([sweepMedia(env), pruneAll(env.DB)]));
}
