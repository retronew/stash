import type { Env } from "#types";
import { runSchedule } from "#cron-tasks";

/** Cron trigger entry point; the tasks are in cron-tasks.ts, the schedule in wrangler.jsonc. */
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(runSchedule(env, controller.cron));
}
