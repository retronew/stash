import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "#lib/api";
import { retentionQuery, type RetentionSettings, type RetentionTarget, type RetentionStats } from "#lib/queries";

/** Retention of one kind of record: its setting, usage, and a save that prunes right away. */
export function useRetention(target: RetentionTarget) {
  const queryClient = useQueryClient();
  const { data, error } = useQuery(retentionQuery);

  async function save(days: number): Promise<{ deleted: number }> {
    const res = await api<{ days: number; deleted: number; stats: RetentionStats }>(`/api/settings/retention/${target}`, {
      method: "PUT",
      json: { days },
    });
    queryClient.setQueryData<RetentionSettings>(retentionQuery.queryKey, (old) =>
      old ? { ...old, targets: { ...old.targets, [target]: { days: res.days, stats: res.stats } } } : old,
    );
    // Pruning changes what the lists and summaries show.
    const affected = target === "events" ? ["events"] : target === "ai_usage" ? ["ai-usage"] : ["media"];
    await queryClient.invalidateQueries({ queryKey: affected });
    return { deleted: res.deleted };
  }

  return { info: data?.targets[target] ?? null, maxDays: data?.maxDays ?? 3650, error, save };
}
