// Scheduled tasks as the settings page shows them: which exist, when they
// last ran and how it went, and when they run next. Times are ms since epoch
// (UTC); the page shows them in the viewer's time zone.

export const CRON_TASKS = ["downloads", "analysis", "thumbs", "hashes", "retention", "backup"] as const;
export type CronTaskId = (typeof CRON_TASKS)[number];

/** ok: ran; skipped: nothing to do (e.g. today's backup exists); error: threw. */
export type CronRunStatus = "ok" | "skipped" | "error";

export interface CronRun {
  id: number;
  task: CronTaskId;
  /** "cron" when triggered by the schedule, "manual" from "Run now". */
  trigger: "cron" | "manual";
  startedAt: number;
  finishedAt: number;
  status: CronRunStatus;
  /** Items handled (downloads queued again, records deleted…). */
  processed: number;
  /** Task-specific numbers, e.g. { removed: 2 } for backups. */
  detail: Record<string, number | string> | null;
  error: string | null;
}

export interface CronTaskView {
  id: CronTaskId;
  /** The cron expression, in UTC. */
  cron: string;
  nextAt: number | null;
  lastRun: CronRun | null;
  /** Latest runs, newest first (per-minute tasks only log runs that did something or failed). */
  recent: CronRun[];
  /**
   * when the schedule last fired after `lastRun`, i.e. the
   * task ran since then with nothing to do (such runs aren't logged; failures
   * always are). null when `lastRun` is the latest run.
   */
  quietAt: number | null;
}

export interface CronOverview {
  tasks: CronTaskView[];
  /** When each schedule last fired, by cron expression; shows the triggers are alive. */
  lastTicks: Record<string, number | null>;
}
