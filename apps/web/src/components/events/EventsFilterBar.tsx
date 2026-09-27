import type { Account, EventOutcome } from "@stash/shared";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import { ScrollFade } from "#components/ScrollFade";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { AccountSelect } from "#components/AccountSelect";
import { outcomeLabel } from "#lib/labels";
import { m } from "#lib/i18n";

export type HitView = "all" | "hit" | "miss";

const OUTCOMES: EventOutcome[] = ["stored", "duplicate", "ignored", "validation", "rejected", "error"];
const ANY = "__any__";

interface Props {
  view: HitView;
  onViewChange: (view: HitView) => void;
  outcome: EventOutcome | undefined;
  onOutcomeChange: (outcome: EventOutcome | undefined) => void;
  account: string;
  onAccountChange: (account: string) => void;
  accounts: Account[];
}

/** Hit / miss toggle, an exact outcome, and the bot. Picking an outcome overrides the toggle. */
export function EventsFilterBar(props: Props) {
  const items: Record<string, string> = { [ANY]: m.filter_any_outcome() };
  for (const o of OUTCOMES) items[o] = outcomeLabel(o);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <ScrollFade className="max-w-full">
        <ToggleGroup
          aria-label={m.filter_view()}
          variant="outline"
          size="sm"
          value={[props.outcome ? "" : props.view]}
          onValueChange={(v) => {
            if (!v[0]) return;
            props.onOutcomeChange(undefined);
            props.onViewChange(v[0] as HitView);
          }}
        >
          <ToggleGroupItem value="all">{m.view_all()}</ToggleGroupItem>
          <ToggleGroupItem value="hit">{m.events_hits()}</ToggleGroupItem>
          <ToggleGroupItem value="miss">{m.events_misses()}</ToggleGroupItem>
        </ToggleGroup>
      </ScrollFade>
      <Select
        value={props.outcome ?? ANY}
        items={items}
        onValueChange={(v) => props.onOutcomeChange(!v || v === ANY ? undefined : (v as EventOutcome))}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {Object.entries(items).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <AccountSelect accounts={props.accounts} value={props.account} onChange={props.onAccountChange} />
    </div>
  );
}
