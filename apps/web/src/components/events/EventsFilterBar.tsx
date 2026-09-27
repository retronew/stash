import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { EVENT_OUTCOMES, type Account, type EventOutcome } from "@stash/shared";
import { MultiSelectFilter, type FilterOption } from "#components/filters/MultiSelectFilter";
import { SingleSelectFilter } from "#components/filters/SingleSelectFilter";
import { ActiveFilters, chipsFor } from "#components/filters/ActiveFilters";
import { accountOptions, enumOptions, optionLabel } from "#components/filters/options";
import { eventTypesQuery, type EventFilters } from "#lib/queries";
import { eventName } from "#lib/event-names";
import { outcomeLabel } from "#lib/labels";
import { m } from "#lib/i18n";

export const EMPTY_EVENT_FILTERS: EventFilters = { accounts: [], hit: "all", outcomes: [], types: [] };

interface Props {
  filters: EventFilters;
  onChange: (patch: Partial<EventFilters>) => void;
  onClear: () => void;
  accounts: Account[];
  /** Changes whenever the list reloads, so the event-type counts follow it. */
  reloadKey: number | null;
}

/** Hit or miss (one of); outcome, event type and bot (any of); and the active filters as chips. */
export function EventsFilterBar({ filters, onChange, onClear, accounts, reloadKey }: Props) {
  const { data: typeCounts, refetch } = useQuery(eventTypesQuery);
  // Counts follow the list: reloaded whenever it refreshes.
  useEffect(() => {
    if (reloadKey) refetch();
  }, [reloadKey, refetch]);
  const hits: { value: EventFilters["hit"]; label: string }[] = [
    { value: "all", label: m.filter_hit_all() },
    { value: "hit", label: m.events_hits() },
    { value: "miss", label: m.events_misses() },
  ];
  const outcomes = enumOptions(EVENT_OUTCOMES, outcomeLabel);
  // The same type can come from several platforms; their counts add up.
  const types: FilterOption[] = [];
  for (const t of typeCounts ?? []) {
    const existing = types.find((o) => o.value === t.type);
    if (existing) existing.count = (existing.count ?? 0) + t.count;
    else types.push({ value: t.type, label: eventName(t.platform, t.type), count: t.count });
  }
  const bots = accountOptions(accounts);
  const setOutcomes = (v: string[]) => onChange({ outcomes: v as EventOutcome[] });
  const setTypes = (types: string[]) => onChange({ types });
  const setBots = (accounts: string[]) => onChange({ accounts });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:flex-wrap">
        <SingleSelectFilter label={m.filter_hit()} options={hits} value={filters.hit} onChange={(hit) => onChange({ hit })} />
        <MultiSelectFilter label={m.filter_outcome()} options={outcomes} selected={filters.outcomes} onChange={setOutcomes} />
        <MultiSelectFilter
          label={m.filter_event_type()}
          options={types}
          selected={filters.types}
          onChange={setTypes}
          className="sm:w-36"
        />
        <MultiSelectFilter label={m.filter_bot()} options={bots} selected={filters.accounts} onChange={setBots} />
      </div>
      <ActiveFilters
        filters={[
          ...(filters.hit === "all"
            ? []
            : [{ key: "hit", label: optionLabel(hits, filters.hit), onRemove: () => onChange({ hit: "all" }) }]),
          ...chipsFor("outcome", filters.outcomes, (v) => optionLabel(outcomes, v), setOutcomes),
          ...chipsFor("type", filters.types, (v) => optionLabel(types, v), setTypes),
          ...chipsFor("bot", filters.accounts, (v) => optionLabel(bots, v), setBots),
        ]}
        onClearAll={onClear}
      />
    </div>
  );
}
