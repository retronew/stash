import { XIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { m } from "#lib/i18n";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/** The filters in effect as removable chips, plus "clear all"; nothing when none are set. */
export function ActiveFilters({ filters, onClearAll }: { filters: ActiveFilter[]; onClearAll: () => void }) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-muted-foreground text-xs">{m.filter_active()}</span>
      {filters.map((f) => (
        <Button key={f.key} size="xs" variant="secondary" onClick={f.onRemove}>
          {f.label}
          <XIcon className="size-3" />
        </Button>
      ))}
      <button
        type="button"
        className="cursor-pointer px-1 text-muted-foreground text-xs underline-offset-2 hover:underline"
        onClick={onClearAll}
      >
        {m.filter_clear_all()}
      </button>
    </div>
  );
}

/** One chip per selected value of a multi-select. */
export function chipsFor(
  key: string,
  selected: string[],
  labelOf: (value: string) => string,
  onChange: (values: string[]) => void,
): ActiveFilter[] {
  return selected.map((value) => ({
    key: `${key}:${value}`,
    label: labelOf(value),
    onRemove: () => onChange(selected.filter((v) => v !== value)),
  }));
}
