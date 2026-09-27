import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { mediaStatsQuery } from "#lib/queries";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

/** One line of download counts; failures link to the task queue. */
export function MediaStatsBar() {
  const { data } = useQuery({ ...mediaStatsQuery, refetchInterval: 15_000 });
  if (!data) return null;
  const inFlight = data.pending + data.downloading;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm animate-fade-in">
      <span>{m.stats_stored({ count: data.stored, size: formatBytes(data.storedBytes) })}</span>
      {inFlight > 0 && <span>{m.stats_in_flight({ count: inFlight })}</span>}
      {data.failed > 0 && (
        <Link to="/tasks" className="text-destructive-foreground underline underline-offset-4">
          {m.stats_failed({ count: data.failed })}
        </Link>
      )}
    </div>
  );
}
