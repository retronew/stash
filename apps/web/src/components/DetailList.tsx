import type { ReactNode } from "react";

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Monospace, and breaks anywhere (ids, URLs, keys). */
  mono?: boolean;
}

/** Label / value pairs for detail dialogs; items with an empty value are left out. */
export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {items
        .filter((i) => i.value !== null && i.value !== undefined && i.value !== "")
        .map((i) => (
          <div key={i.label} className="contents">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className={i.mono ? "min-w-0 break-all font-mono text-xs leading-5" : "min-w-0 break-words"}>{i.value}</dd>
          </div>
        ))}
    </dl>
  );
}
