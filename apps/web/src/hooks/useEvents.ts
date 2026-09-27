import type { EventPage } from "@stash/shared";
import { usePagedList } from "#hooks/usePagedList";
import { eventsQuery, type EventFilters } from "#lib/queries";

const eventsOf = (page: EventPage) => page.events;

/** The webhook event log for the given filters; live refetches every 5 s. */
export function useEvents(filters: EventFilters, live: boolean) {
  const list = usePagedList(eventsQuery(filters), eventsOf, { live });
  return { ...list, events: list.rows };
}
