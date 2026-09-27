import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { StatTile } from "#components/StatTile";
import { mediaStatsQuery } from "#lib/queries";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

/** Download counts and storage used, with "retry all" when something failed. */
export function TaskSummary({ onRetryAll }: { onRetryAll: () => void }) {
  const { data } = useQuery({ ...mediaStatsQuery, refetchInterval: 10_000 });
  if (!data) return <div className="h-[76px]" />;

  return (
    <div className="space-y-3">
      <div className="grid animate-fade-in grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label={m.media_stored()} value={String(data.stored)} />
        <StatTile label={m.media_storage_used()} value={formatBytes(data.storedBytes)} />
        <StatTile label={m.media_in_flight()} value={String(data.pending + data.downloading)} />
        <StatTile label={m.media_failed()} value={String(data.failed)} />
      </div>
      {data.failed > 0 && (
        <Button variant="outline" size="sm" onClick={onRetryAll}>
          <RotateCwIcon />
          {m.action_retry_all_count({ count: data.failed })}
        </Button>
      )}
    </div>
  );
}
