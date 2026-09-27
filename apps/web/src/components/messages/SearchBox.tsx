import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { m } from "#lib/i18n";

interface Props {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}

/** The message search field, with a clear button and a spinner while results load. */
export function SearchBox({ value, onChange, busy }: Props) {
  return (
    <div className="relative">
      <SearchIcon className="z-raised pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder={m.search_placeholder()}
        aria-label={m.search_label()}
        className="ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="z-raised absolute end-2 top-1/2 flex -translate-y-1/2 items-center">
        {busy ? (
          <Spinner className="me-1 size-4" />
        ) : (
          value && (
            <Button variant="ghost" size="icon-xs" aria-label={m.search_clear()} onClick={() => onChange("")}>
              <XIcon />
            </Button>
          )
        )}
      </span>
    </div>
  );
}
