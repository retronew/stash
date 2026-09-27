import type { EventPage } from "@stash/shared";
import { usePagedList } from "#hooks/usePagedList";
import { eventsQuery, type EventFilters } from "#lib/queries";

const eventsOf = (page: EventPage) => page.events;

/** The webhook event log for the given filters. */
export function useEvents(filters: EventFilters) {
  const list = usePagedList(eventsQuery(filters), eventsOf);
  return { ...list, events: list.rows };
}
