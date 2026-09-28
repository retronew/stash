import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { IMAGE_SEARCH_ENGINES, IMAGE_SEARCH_ENGINE_NAMES, type ImageSearchEngine } from "@stash/shared";
import { Button } from "#components/ui/button";
import { Checkbox } from "#components/ui/checkbox";
import { m } from "#lib/i18n";

interface Props {
  /** Enabled engines, in menu order. */
  value: ImageSearchEngine[];
  onChange: (engines: ImageSearchEngine[]) => void;
}

/** Every engine with a checkbox; enabled ones come first, in order, and can be moved. */
export function ImageSearchEnginesField({ value, onChange }: Props) {
  const rows = [...value, ...IMAGE_SEARCH_ENGINES.filter((e) => !value.includes(e))];

  function toggle(engine: ImageSearchEngine, on: boolean) {
    onChange(on ? [...value, engine] : value.filter((e) => e !== engine));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...value];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((engine) => {
        const index = value.indexOf(engine);
        const enabled = index >= 0;
        return (
          <li key={engine} className="flex items-center gap-3 px-3 py-1.5">
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={enabled} onCheckedChange={(on) => toggle(engine, !!on)} />
              <span className={enabled ? undefined : "text-muted-foreground"}>{IMAGE_SEARCH_ENGINE_NAMES[engine]}</span>
            </label>
            {enabled && (
              <div className="flex gap-0.5">
                <Button size="icon-xs" variant="ghost" aria-label={m.image_search_move_up()} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={m.image_search_move_down()}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
