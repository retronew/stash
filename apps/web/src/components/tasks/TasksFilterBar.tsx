import { ATTACHMENT_KINDS, ATTACHMENT_STATUSES, type Account, type AttachmentKind, type AttachmentStatus } from "@stash/shared";
import { MultiSelectFilter } from "#components/filters/MultiSelectFilter";
import { ActiveFilters, chipsFor } from "#components/filters/ActiveFilters";
import { accountOptions, enumOptions, optionLabel } from "#components/filters/options";
import type { TaskFilters } from "#lib/queries";
import { kindLabel, statusLabel } from "#lib/labels";
import { m } from "#lib/i18n";

export const EMPTY_TASK_FILTERS: TaskFilters = { accounts: [], statuses: [], kinds: [] };

interface Props {
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  onClear: () => void;
  accounts: Account[];
}

/** Status, type and bot (each any of), and the active filters as chips. */
export function TasksFilterBar({ filters, onChange, onClear, accounts }: Props) {
  const statuses = enumOptions(ATTACHMENT_STATUSES, statusLabel);
  const kinds = enumOptions(ATTACHMENT_KINDS, kindLabel);
  const bots = accountOptions(accounts);
  const setStatuses = (v: string[]) => onChange({ statuses: v as AttachmentStatus[] });
  const setKinds = (v: string[]) => onChange({ kinds: v as AttachmentKind[] });
  const setBots = (accounts: string[]) => onChange({ accounts });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:flex-wrap">
        <MultiSelectFilter label={m.filter_status()} options={statuses} selected={filters.statuses} onChange={setStatuses} />
        <MultiSelectFilter label={m.filter_kind()} options={kinds} selected={filters.kinds} onChange={setKinds} />
        <MultiSelectFilter label={m.filter_bot()} options={bots} selected={filters.accounts} onChange={setBots} />
      </div>
      <ActiveFilters
        filters={[
          ...chipsFor("status", filters.statuses, (v) => optionLabel(statuses, v), setStatuses),
          ...chipsFor("kind", filters.kinds, (v) => optionLabel(kinds, v), setKinds),
          ...chipsFor("bot", filters.accounts, (v) => optionLabel(bots, v), setBots),
        ]}
        onClearAll={onClear}
      />
    </div>
  );
}
