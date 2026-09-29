// The scheduled tasks, as in PickIt: what each does, and a log of their runs
// for Settings → Scheduled tasks. They all hang off one cron trigger (it must
// match wrangler.jsonc `triggers.crons`; Cloudflare runs it in UTC).

import type { CronOverview, CronRun, CronRunStatus, CronTaskId } from "@stash/shared";
import type { Env } from "#types";
import { sweepAnalysis, sweepDownloads, sweepHashes, sweepThumbs } from "#media/sweep";
import { pruneAll } from "#retention";
import { dailyBackup } from "#backups";
import { safeAudit } from "#audit/index";
import { nextRun } from "#cron-schedule";
import { setSetting, getSetting } from "#settings";

export const EVERY_10_MINUTES = "*/10 * * * *";

const KEEP_MS = 30 * 86_400_000;
const RECENT = 10;

interface TaskResult {
  processed: number;
  detail?: Record<string, number | string>;
  /** Nothing to do (e.g. today's backup already exists). */
  skipped?: boolean;
}

interface CronTask {
  id: CronTaskId;
  cron: string;
  run: (env: Env) => Promise<TaskResult>;
}

const count = (n: number): TaskResult => ({ processed: n });

async function backup(env: Env): Promise<TaskResult> {
  try {
    const made = await dailyBackup(env);
    if (!made) return { processed: 0, skipped: true };
    await safeAudit(env.DB, {
      actor: "system",
      action: "system.backup",
      summary: { key: "audit_sum_daily_backup", params: { count: made.count ?? 0, name: made.name } },
    });
    return { processed: 1, detail: { items: made.count ?? 0, removed: made.removed } };
  } catch (err) {
    await safeAudit(env.DB, {
      actor: "system",
      action: "system.backup",
      summary: { key: "audit_sum_daily_backup_failed" },
      status: 500,
      detail: { error: String(err) },
    });
    throw err;
  }
}

export const TASKS: CronTask[] = [
  // Downloads whose queue message got lost, or whose consumer died.
  { id: "downloads", cron: EVERY_10_MINUTES, run: async (env) => count(await sweepDownloads(env)) },
  // The same for AI analyses.
  { id: "analysis", cron: EVERY_10_MINUTES, run: async (env) => count(await sweepAnalysis(env)) },
  // Thumbnails and AI previews for older images, 20 at a time.
  { id: "thumbs", cron: EVERY_10_MINUTES, run: async (env) => count(await sweepThumbs(env)) },
  // Hashes for files stored before duplicate detection, 90 at a time.
  { id: "hashes", cron: EVERY_10_MINUTES, run: async (env) => count(await sweepHashes(env)) },
  // Records past their retention (events, failed downloads, trash, audit log).
  { id: "retention", cron: EVERY_10_MINUTES, run: async (env) => count(await pruneAll(env.DB, env.MEDIA)) },
  // Today's backup, on the first run after midnight UTC.
  { id: "backup", cron: EVERY_10_MINUTES, run: backup },
];

export const findTask = (id: string) => TASKS.find((t) => t.id === id);

/** Errors D1 raises when its connection drops for a moment; retrying the query works (Cloudflare's advice). */
export function isTransientD1Error(e: unknown): boolean {
  const message = String(e instanceof Error ? e.message : e);
  return /Network connection lost|storage caused object to be reset|transient issue|D1_ERROR: .*(?:timed? ?out|Internal error)/i.test(message);
}

/** Runs a task, once more after a short pause if D1 dropped its connection. */
async function runWithRetry(env: Env, task: CronTask): Promise<TaskResult> {
  try {
    return await task.run(env);
  } catch (e) {
    if (!isTransientD1Error(e)) throw e;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return await task.run(env);
  }
}

/** Runs one task and logs it; scheduled runs that did nothing aren't logged. */
export async function runTask(env: Env, task: CronTask, trigger: "cron" | "manual"): Promise<CronRun | null> {
  const startedAt = Date.now();
  let status: CronRunStatus = "ok";
  let result: TaskResult = { processed: 0 };
  let error: string | null = null;
  try {
    result = await runWithRetry(env, task);
    if (result.skipped) status = "skipped";
  } catch (e) {
    status = "error";
    error = String(e instanceof Error ? e.message : e).slice(0, 500);
  }
  if (trigger === "cron" && status !== "error" && result.processed === 0) return null;
  const finishedAt = Date.now();
  const { meta } = await env.DB.prepare(
    `INSERT INTO cron_runs (task, trigger, started_at, finished_at, status, processed, detail, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(task.id, trigger, startedAt, finishedAt, status, result.processed, result.detail ? JSON.stringify(result.detail) : null, error)
    .run();
  return {
    id: Number(meta.last_row_id),
    task: task.id,
    trigger,
    startedAt,
    finishedAt,
    status,
    processed: result.processed,
    detail: result.detail ?? null,
    error,
  };
}

/** Everything the cron trigger does: note the tick, run the tasks, prune old logs. */
export async function runSchedule(env: Env, cron: string) {
  await setSetting(env.DB, `cron_tick:${cron}`, String(Date.now()));
  await Promise.all(TASKS.filter((t) => t.cron === cron).map((t) => runTask(env, t, "cron")));
  await env.DB.prepare("DELETE FROM cron_runs WHERE started_at < ?").bind(Date.now() - KEEP_MS).run();
}

interface RunRow {
  id: number;
  task: CronTaskId;
  trigger: "cron" | "manual";
  started_at: number;
  finished_at: number;
  status: CronRunStatus;
  processed: number;
  detail: string | null;
  error: string | null;
}

const toRun = (r: RunRow): CronRun => ({
  id: r.id,
  task: r.task,
  trigger: r.trigger,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.status,
  processed: r.processed,
  detail: r.detail ? JSON.parse(r.detail) : null,
  error: r.error,
});

/** Every task with its schedule, next run, latest runs, and when the trigger last fired. */
export async function cronOverview(db: D1Database, now = Date.now()): Promise<CronOverview> {
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY task ORDER BY started_at DESC) AS n FROM cron_runs
       ) WHERE n <= ? ORDER BY started_at DESC`,
    )
    .bind(RECENT)
    .all<RunRow>();
  const runs = results.map(toRun);
  const crons = [...new Set(TASKS.map((t) => t.cron))];
  const ticks = await Promise.all(crons.map((c) => getSetting(db, `cron_tick:${c}`)));
  const lastTicks: Record<string, number | null> = Object.fromEntries(crons.map((c, i) => [c, ticks[i] ? Number(ticks[i]) : null]));
  return {
    tasks: TASKS.map((t) => {
      const recent = runs.filter((r) => r.task === t.id);
      const lastRun = recent[0] ?? null;
      // A tick after the last logged run ended means the task ran again with nothing to do.
      const tick = lastTicks[t.cron];
      const quietAt = tick && (!lastRun || tick > lastRun.finishedAt) ? tick : null;
      return { id: t.id, cron: t.cron, nextAt: nextRun(t.cron, now), lastRun, recent, quietAt };
    }),
    lastTicks,
  };
}
