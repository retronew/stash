import { useQueryClient } from "@tanstack/react-query";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { LiveRefreshControls } from "#components/LiveRefreshControls";
import { EventSummary } from "#components/events/EventSummary";
import { EMPTY_EVENT_FILTERS, EventsFilterBar } from "#components/events/EventsFilterBar";
import { EventRow } from "#components/events/EventRow";
import { EventDetailDialog } from "#components/events/EventDetailDialog";
import { useEvents } from "#hooks/useEvents";
import { useAccounts } from "#hooks/useAccounts";
import { useFilterState } from "#hooks/useFilterState";
import { usePersistentFlag } from "#hooks/usePersistentFlag";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Every webhook call, hit or miss, kept for 30 days; live refresh like PickIt's audit log. */
export function EventsPage() {
  const queryClient = useQueryClient();
  const { filters, set, clear, filtered } = useFilterState(EMPTY_EVENT_FILTERS);
  const [live, setLive] = usePersistentFlag("stash-events-live", true);
  const { accounts } = useAccounts();
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const list = useEvents(filters, live);

  function refresh() {
    list.refresh();
    queryClient.invalidateQueries({ queryKey: ["events", "stats"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading font-semibold text-lg">{m.nav_events()}</h1>
          <p className="text-muted-foreground text-xs">{m.events_description()}</p>
        </div>
        <LiveRefreshControls
          live={live}
          onLiveChange={setLive}
          onRefresh={refresh}
          refreshing={list.refreshing}
          updatedAt={list.updatedAt}
        />
      </div>
      <EventSummary live={live} />
      <EventsFilterBar
        filters={filters}
        onChange={set}
        onClear={clear}
        accounts={accounts ?? []}
        reloadKey={list.updatedAt}
      />
      {list.isLoading ? (
        <PageLoading />
      ) : list.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(list.error) })}</p>
      ) : list.events.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{filtered ? m.list_empty_filtered() : m.events_empty()}</EmptyTitle>
            <EmptyDescription>{filtered ? m.list_empty_filtered_hint() : m.events_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid animate-fade-in gap-2">
          {list.events.map((e) => {
            const acc = e.accountId ? accountById.get(e.accountId) : undefined;
            return (
              <EventRow
                key={e.id}
                event={e}
                account={acc}
                onOpen={(ev) => EventDetailDialog.call({ id: ev.id, account: acc })}
              />
            );
          })}
          <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onLoadMore={list.loadMore} />
        </div>
      )}
      <EventDetailDialog />
    </div>
  );
}
