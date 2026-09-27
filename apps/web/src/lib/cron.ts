import type { CronRun, CronTaskId } from "@stash/shared";
import { m } from "#lib/i18n";

export const CRON_TASK_LABELS: Record<CronTaskId, { name: () => string; hint: () => string }> = {
  downloads: { name: m.cron_task_downloads, hint: m.cron_task_downloads_hint },
  analysis: { name: m.cron_task_analysis, hint: m.cron_task_analysis_hint },
  thumbs: { name: m.cron_task_thumbs, hint: m.cron_task_thumbs_hint },
  retention: { name: m.cron_task_retention, hint: m.cron_task_retention_hint },
  backup: { name: m.cron_task_backup, hint: m.cron_task_backup_hint },
};

/** "Every 10 minutes"; the only schedule Stash has. */
export function scheduleLabel(cron: string): string {
  return cron === "*/10 * * * *" ? m.cron_group_10min() : cron;
}

/** "12 processed · 2 removed" for a run. */
export function runSummary(run: CronRun): string {
  const parts = [m.cron_processed({ count: run.processed })];
  const d = run.detail ?? {};
  if (typeof d.items === "number") parts.push(m.cron_detail_items({ count: d.items }));
  if (typeof d.removed === "number" && d.removed > 0) parts.push(m.cron_detail_removed({ count: d.removed }));
  return parts.join(" · ");
}
