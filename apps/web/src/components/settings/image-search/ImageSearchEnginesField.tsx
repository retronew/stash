import { IMAGE_SEARCH_ENGINES, IMAGE_SEARCH_ENGINE_NAMES, type ImageSearchEngine } from "@stash/shared";
import { Checkbox } from "#components/ui/checkbox";
import { HANDLE_SLOT, SortableList } from "#components/SortableList";
import { EngineIcon } from "#components/EngineIcon";

interface Props {
  /** Enabled engines, in menu order. */
  value: ImageSearchEngine[];
  onChange: (engines: ImageSearchEngine[]) => void;
}

/** Same height and gutter whether or not the row has a drag handle. */
const rowClass = "flex min-h-10 items-center gap-2 px-3";

/** Every engine with a checkbox; enabled ones come first and are reordered by dragging. */
export function ImageSearchEnginesField({ value, onChange }: Props) {
  const disabled = IMAGE_SEARCH_ENGINES.filter((e) => !value.includes(e));

  const toggle = (engine: ImageSearchEngine, on: boolean) =>
    onChange(on ? [...value, engine] : value.filter((e) => e !== engine));

  const row = (engine: ImageSearchEngine, enabled: boolean) => (
    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={enabled} onCheckedChange={(on) => toggle(engine, !!on)} />
      <EngineIcon engine={engine} className={enabled ? undefined : "opacity-50 grayscale"} />
      <span className={enabled ? undefined : "text-muted-foreground"}>{IMAGE_SEARCH_ENGINE_NAMES[engine]}</span>
    </label>
  );

  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {value.length > 0 && (
        <SortableList
          items={value}
          onReorder={onChange}
          renderItem={(engine) => row(engine, true)}
          className="divide-y"
          itemClassName={rowClass}
        />
      )}
      {disabled.length > 0 && (
        <ul className="divide-y">
          {disabled.map((engine) => (
            <li key={engine} className={rowClass}>
              <span className={HANDLE_SLOT} />
              {row(engine, false)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
