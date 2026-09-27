import type { Message } from "@stash/shared";
import { RotateCcwIcon, SparklesIcon, TagIcon, Trash2Icon } from "lucide-react";
import { MenuItem, MenuSeparator } from "#components/ui/menu";
import { m } from "#lib/i18n";

/** Menu items of a live message: analyze, edit labels, move to the recycle bin. */
export function MessageMenuItems({
  message,
  onAnalyze,
  onEditLabels,
  onDelete,
}: {
  message: Message;
  onAnalyze: () => void;
  onEditLabels: () => void;
  onDelete: () => void;
}) {
  const busy = message.aiStatus === "pending" || message.aiStatus === "running";
  return (
    <>
      <MenuItem disabled={busy} onClick={onAnalyze}>
        <SparklesIcon />
        {message.aiStatus === "" ? m.message_analyze() : m.message_reanalyze()}
      </MenuItem>
      <MenuItem onClick={onEditLabels}>
        <TagIcon />
        {m.message_edit_labels()}
      </MenuItem>
      <MenuSeparator />
      <MenuItem variant="destructive" onClick={onDelete}>
        <Trash2Icon />
        {m.action_delete()}
      </MenuItem>
    </>
  );
}

/** Menu items of a message in the recycle bin: restore, delete for good. */
export function TrashMenuItems({ onRestore, onPurge }: { onRestore: () => void; onPurge: () => void }) {
  return (
    <>
      <MenuItem onClick={onRestore}>
        <RotateCcwIcon />
        {m.action_restore()}
      </MenuItem>
      <MenuSeparator />
      <MenuItem variant="destructive" onClick={onPurge}>
        <Trash2Icon />
        {m.action_purge()}
      </MenuItem>
    </>
  );
}
