import { useQuery } from "@tanstack/react-query";
import { HIT_OUTCOMES } from "@stash/shared";
import { StatTile } from "#components/StatTile";
import { eventStatsQuery } from "#lib/queries";
import { m } from "#lib/i18n";

const HOURS = 24;

/** Webhook calls in the last 24 hours: all, hits, misses, and those that failed. */
export function EventSummary({ live }: { live: boolean }) {
  const { data } = useQuery({ ...eventStatsQuery(HOURS), refetchInterval: live ? 5000 : false });
  const hits = data && HIT_OUTCOMES.reduce((n, o) => n + data.byOutcome[o], 0);
  const count = (n: number | undefined) => (n === undefined ? undefined : String(n));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label={m.events_total_24h()} value={count(data?.total)} />
      <StatTile label={m.events_hits()} value={count(hits)} hint={m.events_hits_hint()} />
      <StatTile label={m.events_misses()} value={count(data && data.total - hits!)} hint={m.events_misses_hint()} />
      <StatTile
        label={m.events_problems()}
        value={count(data && data.byOutcome.rejected + data.byOutcome.error)}
        hint={m.events_problems_hint()}
      />
    </div>
  );
}
