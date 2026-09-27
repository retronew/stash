import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@stash/shared";
import { Confirm } from "#components/Confirm";
import { TagsEditDialog } from "#components/messages/TagsEditDialog";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

export type BulkAction = "trash" | "restore" | "purge" | "category" | "add_tags" | "remove_tags";

/** Select mode and the bulk actions on the selection, as on PickIt's items page. */
export function useMessageSelection(messages: Message[], allTags: string[] = []) {
  const queryClient = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selected = messages.filter((msg) => selectedIds.has(msg.id));

  const refresh = () =>
    Promise.all(
      [["messages"], ["media"], ["analysis"], ["accounts"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Selects every loaded message, or clears the selection when all are selected. */
  function toggleAll() {
    setSelectedIds((prev) =>
      messages.every((msg) => prev.has(msg.id)) ? new Set() : new Set(messages.map((msg) => msg.id)),
    );
  }

  function exit() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function run(action: BulkAction, extra: { category?: string; tags?: string[] } = {}, done?: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const { changed } = await api<{ changed: number }>("/api/messages/bulk", { json: { ids, action, ...extra } });
      toastSuccess(done ?? m.bulk_done({ count: changed }), { id: "message-bulk" });
      exit();
    } catch (err) {
      toastError(m.bulk_failed(), err, { id: "message-bulk" });
    }
    await refresh();
  }

  async function trash() {
    const ok = await Confirm.call({
      title: m.bulk_delete_title({ count: selectedIds.size }),
      message: m.message_delete_message(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (ok) await run("trash", {}, m.bulk_done_trash({ count: selectedIds.size }));
  }

  async function purge() {
    const ok = await Confirm.call({
      title: m.bulk_purge_title({ count: selectedIds.size }),
      message: m.purge_message(),
      confirmLabel: m.action_purge(),
      danger: true,
    });
    if (ok) await run("purge");
  }

  async function editTags(mode: "add" | "remove") {
    const suggestions = mode === "add" ? allTags : [...new Set(selected.flatMap((msg) => msg.tags))].sort();
    const tags = await TagsEditDialog.call({ mode, count: selectedIds.size, suggestions });
    if (tags) await run(mode === "add" ? "add_tags" : "remove_tags", { tags });
  }

  async function analyze() {
    try {
      const { queued } = await api<{ queued: number }>("/api/analysis/queue", { json: { ids: [...selectedIds] } });
      toastSuccess(m.analysis_queued({ count: queued }), { id: "message-bulk" });
      exit();
    } catch (err) {
      toastError(m.analysis_queue_failed(), err, { id: "message-bulk" });
    }
    await refresh();
  }

  /** Downloads the selection's failed files again. */
  async function retryFiles() {
    const ids = selected.flatMap((msg) => msg.attachments.filter((a) => a.status === "failed").map((a) => a.id));
    try {
      const { queued } = await api<{ queued: number }>("/api/media/retry", { json: { ids } });
      toastSuccess(m.bulk_retry_done({ count: queued }), { id: "message-bulk" });
      exit();
    } catch (err) {
      toastError(m.bulk_failed(), err, { id: "message-bulk" });
    }
    await refresh();
  }

  return {
    selectMode,
    start: () => setSelectMode(true),
    exit,
    selectedIds,
    allSelected: messages.length > 0 && messages.every((msg) => selectedIds.has(msg.id)),
    failedFiles: selected.reduce((n, msg) => n + msg.attachments.filter((a) => a.status === "failed").length, 0),
    toggle,
    toggleAll,
    trash,
    restore: () => run("restore", {}, m.bulk_done_restore({ count: selectedIds.size })),
    purge,
    setCategory: (category: string) => run("category", { category }),
    editTags,
    analyze,
    retryFiles,
  };
}

export type MessageSelection = ReturnType<typeof useMessageSelection>;
