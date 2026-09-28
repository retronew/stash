import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "#components/ui/autocomplete";
import { useSuggestionFilter } from "#hooks/useSuggestionFilter";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  /** Shown when no suggestion matches the text (it's still accepted). */
  emptyLabel?: string;
}

/** A single free-text value with suggestions to pick from. */
export function SuggestField({ id, value, onChange, suggestions, placeholder, emptyLabel }: Props) {
  const { filteredItems, onOpenChange } = useSuggestionFilter(suggestions, value);
  return (
    <Autocomplete
      items={suggestions}
      filteredItems={filteredItems}
      value={value}
      onValueChange={(v) => onChange(v)}
      onOpenChange={onOpenChange}
      openOnInputClick
    >
      <AutocompleteInput id={id} size="lg" placeholder={placeholder} showTrigger={suggestions.length > 0} />
      <AutocompletePopup>
        {emptyLabel && <AutocompleteEmpty>{emptyLabel}</AutocompleteEmpty>}
        <AutocompleteList>
          {(item: string) => (
            <AutocompleteItem key={item} value={item}>
              {item}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
