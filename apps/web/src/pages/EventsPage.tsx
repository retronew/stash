import { useState } from "react";
import type { EventOutcome } from "@stash/shared";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { EventSummary } from "#components/events/EventSummary";
import { EventsFilterBar, type HitView } from "#components/events/EventsFilterBar";
import { EventRow } from "#components/events/EventRow";
import { EventDetailDialog } from "#components/events/EventDetailDialog";
import { useEvents } from "#hooks/useEvents";
import { useAccounts } from "#hooks/useAccounts";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Every webhook call, hit or miss, kept for 30 days. */
export function EventsPage() {
  const [view, setView] = useState<HitView>("all");
  const [outcome, setOutcome] = useState<EventOutcome>();
  const [account, setAccount] = useState("");
  const { accounts } = useAccounts();
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const list = useEvents({
    account: account || undefined,
    outcome,
    hit: outcome ? undefined : view === "all" ? undefined : view === "hit",
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">{m.nav_events()}</h1>
        <p className="text-muted-foreground text-sm">{m.events_description()}</p>
      </div>
      <EventSummary />
      <EventsFilterBar
        view={view}
        onViewChange={setView}
        outcome={outcome}
        onOutcomeChange={setOutcome}
        account={account}
        onAccountChange={setAccount}
        accounts={accounts ?? []}
      />
      {list.isLoading ? (
        <PageLoading />
      ) : list.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(list.error) })}</p>
      ) : list.events.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.events_empty()}</EmptyTitle>
            <EmptyDescription>{m.events_empty_hint()}</EmptyDescription>
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
