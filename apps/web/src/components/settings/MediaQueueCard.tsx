import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { StatTile } from "#components/StatTile";
import { ListSkeleton } from "#components/settings/skeletons";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { mediaStatsQuery } from "#lib/queries";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

/** Download queue at a glance, and a way to retry every failed download. */
export function MediaQueueCard() {
  const retry = useMediaRetry();
  const { data } = useQuery({ ...mediaStatsQuery, refetchInterval: 10_000 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.media_title()}</CardTitle>
        <CardDescription>{m.media_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <ListSkeleton rows={2} />
        ) : (
          <div className="grid animate-fade-in grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label={m.media_stored()} value={String(data.stored)} />
            <StatTile label={m.media_storage_used()} value={formatBytes(data.storedBytes)} />
            <StatTile label={m.media_in_flight()} value={String(data.pending + data.downloading)} />
            <StatTile label={m.media_failed()} value={String(data.failed)} />
          </div>
        )}
        <Button variant="outline" disabled={!data?.failed} onClick={() => retry()}>
          <RotateCwIcon />
          {m.action_retry_all()}
        </Button>
      </CardContent>
    </Card>
  );
}
