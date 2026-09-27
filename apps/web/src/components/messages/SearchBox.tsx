import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { MarqueeText } from "#components/MarqueeText";
import { m } from "#lib/i18n";

interface Props {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}

/** The message search field, laid out like PickIt's: the icon turns into a spinner while results load. */
export function SearchBox({ value, onChange, busy }: Props) {
  const iconClass = "z-raised pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground";
  return (
    <div className="relative">
      {busy ? <Spinner className={iconClass} /> : <SearchIcon className={iconClass} />}
      <Input
        type="search"
        size="lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        aria-label={m.search_label()}
        aria-busy={busy}
        className="pl-7 pr-9 [&_input::-webkit-search-cancel-button]:hidden"
      />
      {/* Placeholder as an overlay so a long hint can scroll instead of being cut off. */}
      {!value && (
        <MarqueeText className="pointer-events-none absolute inset-y-0 left-10 right-9 z-raised flex items-center text-base text-muted-foreground/72 sm:text-sm">
          {m.search_placeholder()}
        </MarqueeText>
      )}
      {value && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.search_clear()}
          onClick={() => onChange("")}
          className="z-raised absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
