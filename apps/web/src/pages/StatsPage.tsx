import { useQuery } from "@tanstack/react-query";
import { StatTile } from "#components/StatTile";
import { PageLoading } from "#components/PageLoading";
import { StatCard } from "#components/stats/StatCharts";
import { RankBarChart } from "#components/stats/RankBarChart";
import { TrendChart } from "#components/stats/TrendChart";
import { CategoryDonutChart } from "#components/stats/CategoryDonutChart";
import { fillMonths } from "#lib/fillMonths";
import { useAccounts } from "#hooks/useAccounts";
import { statsQuery } from "#lib/queries";
import { lastDays } from "#lib/stats-data";
import { chatTypeLabel, kindLabel, platformLabel } from "#lib/labels";
import { shortId } from "#components/filters/options";
import { formatBytes } from "#lib/format";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Totals and breakdowns of what has been collected, as on PickIt's Stats page. */
export function StatsPage() {
  const { data: stats, error } = useQuery(statsQuery);
  const { accounts } = useAccounts();
  if (error) return <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(error) })}</p>;
  if (!stats) return <PageLoading />;
  const botName = (id: string, name: string, platform: string) =>
    name || accounts?.find((a) => a.id === id)?.name || platformLabel(platform as never);

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-heading font-semibold text-lg">{m.nav_stats()}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={m.stats_messages()} value={String(stats.messages)} />
        <StatTile label={m.stats_files()} value={`${stats.files} · ${formatBytes(stats.bytes)}`} />
        <StatTile
          label={m.stats_analyzed()}
          value={stats.messages ? `${Math.round((stats.analyzed / stats.messages) * 100)}%` : "—"}
          hint={m.stats_analyzed_hint({ analyzed: stats.analyzed, embedded: stats.embedded })}
        />
        <StatTile label={m.nav_trash()} value={String(stats.trash)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <StatCard title={m.stats_by_day()} description={m.stats_by_day_hint()}>
            <TrendChart rows={lastDays(stats.byDay)} />
          </StatCard>
          <StatCard title={m.stats_by_month()}>
            <TrendChart rows={fillMonths(stats.byMonth).map((r) => ({ label: r.month, count: r.count }))} />
          </StatCard>
          <StatCard title={m.stats_by_bot()}>
            <RankBarChart rows={stats.byBot.map((r) => ({ label: botName(r.accountId, r.name, r.platform), count: r.count }))} />
          </StatCard>
          <StatCard title={m.stats_by_chat_type()}>
            <RankBarChart rows={stats.byChatType.map((r) => ({ label: chatTypeLabel(r.chatType), count: r.count }))} />
          </StatCard>
        </div>
        <div className="flex flex-col gap-6">
          <StatCard title={m.stats_by_category()} description={m.stats_by_category_hint()}>
            <CategoryDonutChart rows={stats.byCategory.map((r) => ({ label: r.category || m.stats_uncategorized(), count: r.count }))} />
          </StatCard>
          <StatCard title={m.stats_top_chats()}>
            <RankBarChart
              rows={stats.topChats.map((r) => ({ label: `${chatTypeLabel(r.chatType)} · ${r.name || shortId(r.chatId)}`, count: r.count }))}
            />
          </StatCard>
          <StatCard
            title={m.stats_by_kind()}
            footer={stats.failedFiles ? m.stats_failed_files({ count: stats.failedFiles }) : undefined}
          >
            <RankBarChart rows={stats.byKind.map((r) => ({ label: `${kindLabel(r.kind)} · ${formatBytes(r.bytes)}`, count: r.count }))} />
          </StatCard>
        </div>
      </div>
    </div>
  );
}
