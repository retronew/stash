import { Card } from "#components/ui/card";
import { cn } from "#lib/utils";
import { Hint } from "#components/Hint";
import { Skeleton } from "#components/ui/skeleton";

interface Props {
  label: string;
  /** undefined while loading: a placeholder the same height as the number. */
  value: string | undefined;
  /** Shown on hover, e.g. the exact time behind "5 minutes ago". */
  hint?: string;
  /** Smaller padding and number, for dialogs. */
  compact?: boolean;
}

/** A labelled key figure on a card, for rows of stats; the label shows while the value loads. */
export function StatTile({ label, value, hint, compact }: Props) {
  return (
    <Card className={cn("min-w-0 gap-0", compact ? "p-3" : "p-4")}>
      <p className="truncate text-muted-foreground text-xs">{label}</p>
      {value === undefined ? (
        <div className={cn("flex items-center", compact ? "h-7" : "h-8")} aria-busy="true">
          <Skeleton className={cn("w-12", compact ? "h-5" : "h-6")} />
        </div>
      ) : (
        <Hint content={hint}>
          <p className={cn("w-fit max-w-full animate-fade-in truncate font-heading font-semibold", compact ? "text-xl" : "text-2xl")}>
            {value}
          </p>
        </Hint>
      )}
    </Card>
  );
}
