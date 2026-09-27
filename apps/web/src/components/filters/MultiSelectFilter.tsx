import { useMemo, useState, type ReactNode } from "react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "#components/ui/combobox";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface Props {
  /** The field's name: the placeholder, and "name · 2" once something is picked. */
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

/** A searchable multi-select that stays open while picking (PickIt's tag filter). */
export function MultiSelectFilter({ label, options, selected, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const values = useMemo(() => options.map((o) => o.value), [options]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  return (
    <div className={cn("min-w-0 max-sm:flex-1 sm:w-32", className)}>
      <Combobox
        items={values}
        multiple
        open={open}
        value={selected}
        itemToStringLabel={(value: string) => byValue.get(value)?.label ?? value}
        onOpenChange={(next, details) => {
          if (!next && details.reason === "item-press") return;
          setOpen(next);
        }}
        onValueChange={onChange}
      >
        <ComboboxInput
          aria-label={label}
          placeholder={selected.length ? `${label} · ${selected.length}` : label}
          size="sm"
        />
        <ComboboxPopup>
          <ComboboxEmpty>{m.filter_no_match()}</ComboboxEmpty>
          <ComboboxList>
            {(value: string) => {
              const o = byValue.get(value);
              return (
                <ComboboxItem key={value} value={value}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      {o?.icon}
                      <span className="truncate">{o?.label ?? value}</span>
                    </span>
                    {o?.count !== undefined && <span className="shrink-0 text-muted-foreground text-xs">{o.count}</span>}
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}
