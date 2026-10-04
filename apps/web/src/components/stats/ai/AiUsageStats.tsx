import { useState } from "react";
import { AI_USAGE_RANGES } from "@stash/shared";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { StatTile } from "#components/StatTile";
import { PageLoading } from "#components/PageLoading";
import { StatCard } from "#components/stats/StatCharts";
import { CategoryDonutChart } from "#components/stats/CategoryDonutChart";
import { AiUsageTrendChart } from "#components/stats/ai/AiUsageTrendChart";
import { AiModelList } from "#components/stats/ai/AiModelList";
import { RetentionCard } from "#components/settings/retention/RetentionCard";
import { useAiUsage } from "#hooks/useAiUsage";
import { AI_FEATURE_LABELS, formatCount, formatTokens } from "#lib/ai-usage";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

/** The "AI usage" tab of the stats page: calls and tokens by day, model and feature. */
export function AiUsageStats() {
  const [days, setDays] = useState<number>(30);
  const { report, loading, error } = useAiUsage(days);

  return (
    <div className="space-y-6">
      <ToggleGroup
        aria-label={m.stats_tab_ai()}
        variant="outline"
        size="sm"
        value={[String(days)]}
        onValueChange={(v) => v[0] && setDays(Number(v[0]))}
      >
        {AI_USAGE_RANGES.map((d) => (
          <ToggleGroupItem key={d} value={String(d)}>
            {m.ai_usage_range_days({ days: d })}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {!report ? (
        error ? (
          <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(error) })}</p>
        ) : (
          <PageLoading />
        )
      ) : (
        <div className={cn("animate-fade-in space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={m.ai_usage_calls()} value={formatCount(report.totals.calls)} />
            <StatTile
              label={m.ai_usage_input_tokens()}
              value={formatTokens(report.totals.inputTokens)}
              hint={formatCount(report.totals.inputTokens)}
            />
            <StatTile
              label={m.ai_usage_output_tokens()}
              value={formatTokens(report.totals.outputTokens)}
              hint={formatCount(report.totals.outputTokens)}
            />
            <StatTile
              label={m.ai_usage_failed()}
              value={formatCount(report.totals.failed)}
              hint={
                report.totals.calls
                  ? m.ai_usage_failed_rate({ rate: `${Math.round((report.totals.failed / report.totals.calls) * 100)}%` })
                  : undefined
              }
            />
          </div>

          {report.totals.calls === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyTitle>{m.ai_usage_empty()}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <StatCard title={m.ai_usage_by_day()} description={m.ai_usage_by_day_hint()}>
                <AiUsageTrendChart data={report.byDay} />
              </StatCard>
              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <div className="min-w-0">
                  <StatCard title={m.ai_usage_by_model()} description={m.ai_usage_by_model_hint()}>
                    <AiModelList data={report.byModel} />
                  </StatCard>
                </div>
                <StatCard title={m.ai_usage_by_feature()} description={m.ai_usage_by_feature_hint()}>
                  <CategoryDonutChart
                    rows={report.byFeature.map((f) => ({ label: AI_FEATURE_LABELS[f.feature]?.() ?? f.feature, count: f.calls }))}
                  />
                </StatCard>
              </div>
            </>
          )}
        </div>
      )}

      <RetentionCard target="ai_usage" title={m.data_ai_usage_title()} description={m.data_ai_usage_description()} />
    </div>
  );
}
