import { useQuery } from "@tanstack/react-query";
import { HIT_OUTCOMES } from "@stash/shared";
import { StatTile } from "#components/StatTile";
import { eventStatsQuery } from "#lib/queries";
import { m } from "#lib/i18n";

const HOURS = 24;

/** Webhook calls in the last 24 hours: all, hits, misses, and those that failed. */
export function EventSummary() {
  const { data } = useQuery({ ...eventStatsQuery(HOURS), refetchInterval: 30_000 });
  if (!data) return <div className="h-[76px]" />;
  const hits = HIT_OUTCOMES.reduce((n, o) => n + data.byOutcome[o], 0);
  const problems = data.byOutcome.rejected + data.byOutcome.error;

  return (
    <div className="grid animate-fade-in grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label={m.events_total_24h()} value={String(data.total)} />
      <StatTile label={m.events_hits()} value={String(hits)} hint={m.events_hits_hint()} />
      <StatTile label={m.events_misses()} value={String(data.total - hits)} hint={m.events_misses_hint()} />
      <StatTile label={m.events_problems()} value={String(problems)} hint={m.events_problems_hint()} />
    </div>
  );
}
