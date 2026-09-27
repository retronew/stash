import { useState } from "react";
import {
  CheckCheckIcon,
  FolderIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SparklesIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "#components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "#components/ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import type { MessageSelection } from "#hooks/useMessageSelection";
import { m } from "#lib/i18n";

interface Props {
  selection: MessageSelection;
  /** "trash": restore and delete forever instead of the editing actions. */
  variant?: "feed" | "trash";
  categories?: string[];
}

/** The sticky bar over a selection of messages, as in PickIt. */
export function BulkActionBar({ selection: s, variant = "feed", categories = [] }: Props) {
  const [resetKey, setResetKey] = useState(0);
  const count = s.selectedIds.size;

  return (
    <div className="sticky top-17 z-40 flex flex-wrap items-center gap-2 rounded-xl border bg-popover/95 not-dark:bg-clip-padding px-3 py-2 shadow-lg/10 backdrop-blur">
      <span className="font-medium text-sm">{m.bulk_selected({ count })}</span>
      <Button variant="ghost" size="sm" onClick={s.toggleAll}>
        <CheckCheckIcon />
        <span className="max-sm:sr-only">{s.allSelected ? m.bulk_select_none() : m.bulk_select_all()}</span>
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {variant === "trash" ? (
          <>
            <Button variant="outline" size="sm" disabled={!count} onClick={s.restore}>
              <RotateCcwIcon />
              <span className="max-sm:sr-only">{m.action_restore()}</span>
            </Button>
            <Button variant="destructive" size="sm" disabled={!count} onClick={s.purge}>
              <Trash2Icon />
              <span className="max-sm:sr-only">{m.action_purge()}</span>
            </Button>
          </>
        ) : (
          <>
            {categories.length > 0 && (
              <Select
                key={resetKey}
                disabled={!count}
                onValueChange={(v) => {
                  s.setCategory(v as string);
                  setResetKey((k) => k + 1);
                }}
              >
                <SelectTrigger size="sm" className="w-auto min-w-0">
                  <FolderIcon className="size-4" />
                  <SelectValue placeholder={m.bulk_move_category()} />
                </SelectTrigger>
                <SelectPopup>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            )}
            <Menu>
              <MenuTrigger disabled={!count} render={<Button variant="outline" size="sm" />}>
                <TagsIcon />
                <span className="max-sm:sr-only">{m.bulk_tags()}</span>
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuItem onClick={() => s.editTags("add")}>
                  <PlusIcon />
                  {m.bulk_add_tags()}
                </MenuItem>
                <MenuItem onClick={() => s.editTags("remove")}>
                  <MinusIcon />
                  {m.bulk_remove_tags()}
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Button variant="outline" size="sm" disabled={!count} onClick={s.analyze}>
              <SparklesIcon />
              <span className="max-sm:sr-only">{m.bulk_analyze()}</span>
            </Button>
            {s.failedFiles > 0 && (
              <Button variant="outline" size="sm" onClick={s.retryFiles}>
                <RotateCwIcon />
                <span className="max-sm:sr-only">{m.bulk_retry_files({ count: s.failedFiles })}</span>
              </Button>
            )}
            <Button variant="destructive" size="sm" disabled={!count} onClick={s.trash}>
              <Trash2Icon />
              <span className="max-sm:sr-only">{m.action_delete()}</span>
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={m.bulk_cancel()} onClick={s.exit}>
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
