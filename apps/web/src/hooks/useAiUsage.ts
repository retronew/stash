import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { aiUsageQuery } from "#lib/queries";
import { browserTimeZone } from "#lib/ai-usage";
import { m } from "#lib/i18n";

/** AI token usage over the last `days`, counted in the browser's time zone. */
export function useAiUsage(days: number) {
  const report = useQuery({
    ...aiUsageQuery(days, browserTimeZone()),
    placeholderData: keepPreviousData,
    meta: { errorToast: { title: m.ai_usage_load_failed, id: "ai-usage" } },
  });
  return { report: report.data ?? null, loading: report.isFetching, error: report.error };
}
