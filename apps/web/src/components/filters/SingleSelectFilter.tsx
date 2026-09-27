import type { ReactNode } from "react";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";

interface Props<T extends string> {
  /** Accessible name of the control. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Shown before the value, e.g. a filter icon. */
  icon?: ReactNode;
}

/** A compact one-of-several select for a filter bar (PickIt's sort control). */
export function SingleSelectFilter<T extends string>({ label, options, value, onChange, icon }: Props<T>) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select value={value} items={items} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger size="sm" aria-label={label} className="w-auto min-w-0 shrink-0 bg-background">
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
