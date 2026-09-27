import { useQueryClient } from "@tanstack/react-query";
import type { MessagePage } from "@stash/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { trashQuery } from "#lib/queries";
import { usePagedList } from "#hooks/usePagedList";
import { m } from "#lib/i18n";

const messagesOf = (page: MessagePage) => page.messages;

/** The recycle bin with restore, purge and empty (as in PickIt). */
export function useTrash() {
  const queryClient = useQueryClient();
  const list = usePagedList(trashQuery, messagesOf);
  // The "messages" prefix covers the bin and the feed; counts and stats change too.
  const refresh = () =>
    Promise.all(
      [["messages"], ["media"], ["analysis"], ["accounts"], ["settings", "retention"]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  async function restore(id: number) {
    try {
      await api(`/api/messages/${id}/restore`, { method: "POST" });
      toastSuccess(m.restored(), { id: "trash" });
    } catch (err) {
      toastError(m.restore_failed(), err, { id: "trash" });
    }
    await refresh();
  }

  async function purge(id: number) {
    try {
      await api(`/api/messages/${id}/purge`, { method: "DELETE" });
      toastSuccess(m.purged(), { id: "trash" });
    } catch (err) {
      toastError(m.message_delete_failed(), err, { id: "trash" });
    }
    await refresh();
  }

  async function empty() {
    try {
      // A very large bin takes a few rounds.
      for (let round = 0; round < 20; round++) {
        const { done } = await api<{ done: boolean }>("/api/messages/trash/empty", { method: "POST" });
        if (done) break;
      }
      toastSuccess(m.trash_emptied(), { id: "trash" });
    } catch (err) {
      toastError(m.empty_trash_failed(), err, { id: "trash" });
    }
    await refresh();
  }

  return { ...list, messages: list.rows, restore, purge, empty };
}
