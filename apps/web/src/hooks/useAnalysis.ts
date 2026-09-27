import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisSettings } from "@stash/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { analysisSettingsQuery, analysisStatsQuery } from "#lib/queries";
import { m } from "#lib/i18n";

export type AnalysisScope = "unanalyzed" | "failed" | "all";

/** AI analysis: its settings, progress, and queueing messages for it. */
export function useAnalysis(live = false) {
  const queryClient = useQueryClient();
  const settings = useQuery(analysisSettingsQuery);
  const stats = useQuery({ ...analysisStatsQuery, refetchInterval: live ? 5000 : false });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["analysis"] }),
      queryClient.invalidateQueries({ queryKey: ["messages"] }),
    ]);

  async function save(patch: Partial<AnalysisSettings>) {
    const next = await api<AnalysisSettings>("/api/analysis/settings", { method: "PUT", json: patch });
    queryClient.setQueryData(analysisSettingsQuery.queryKey, next);
    return next;
  }

  /** Queues messages: a scope, or these ids. Reports how many with a toast. */
  async function queue(target: AnalysisScope | number[]) {
    try {
      const { queued } = await api<{ queued: number }>("/api/analysis/queue", {
        json: Array.isArray(target) ? { ids: target } : { scope: target },
      });
      toastSuccess(m.analysis_queued({ count: queued }), { id: "analysis-queue" });
      await refresh();
    } catch (err) {
      toastError(m.analysis_queue_failed(), err, { id: "analysis-queue" });
    }
  }

  /** Rebuilds vectors with the current embedding model (PickIt's reembed). */
  async function reembed(mode: "missing" | "all") {
    try {
      const { queued } = await api<{ queued: number }>("/api/analysis/reembed", { json: { mode } });
      toastSuccess(m.reembed_queued({ count: queued }), { id: "reembed" });
      await refresh();
    } catch (err) {
      toastError(m.reembed_failed(), err, { id: "reembed" });
    }
  }

  return { reembed, settings: settings.data ?? null, stats: stats.data ?? null, statsError: stats.error, save, queue };
}
