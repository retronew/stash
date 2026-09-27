import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { mediaStatsQuery } from "#lib/queries";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

/** One line of download counts, with "retry all" when something failed. */
export function MediaStatsBar({ onRetryAll }: { onRetryAll: () => void }) {
  const { data } = useQuery({ ...mediaStatsQuery, refetchInterval: 15_000 });
  if (!data) return null;
  const inFlight = data.pending + data.downloading;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm animate-fade-in">
      <span>{m.stats_stored({ count: data.stored, size: formatBytes(data.storedBytes) })}</span>
      {inFlight > 0 && <span>{m.stats_in_flight({ count: inFlight })}</span>}
      {data.failed > 0 && (
        <>
          <span className="text-destructive-foreground">{m.stats_failed({ count: data.failed })}</span>
          <Button size="xs" variant="outline" onClick={onRetryAll}>
            <RotateCwIcon />
            {m.action_retry_all()}
          </Button>
        </>
      )}
    </div>
  );
}
