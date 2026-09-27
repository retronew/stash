import { useQueryClient } from "@tanstack/react-query";
import type { Message, MessagePage } from "@stash/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { messagesQuery, type MessageFilters } from "#lib/queries";
import { usePagedList } from "#hooks/usePagedList";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { m } from "#lib/i18n";

const messagesOf = (page: MessagePage) => page.messages;
const inFlight = (messages: Message[]) =>
  messages.some((msg) => msg.attachments.some((a) => a.status === "pending" || a.status === "downloading"));

/** The message feed for the given filters, with paging, delete and retry. Polls while files are downloading. */
export function useMessages(filters: MessageFilters) {
  const queryClient = useQueryClient();
  const retry = useMediaRetry();
  const list = usePagedList(messagesQuery(filters), messagesOf, { pollWhile: inFlight });

  async function remove(id: number) {
    try {
      await api(`/api/messages/${id}`, { method: "DELETE" });
      toastSuccess(m.message_deleted(), { id: "message-delete" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
        queryClient.invalidateQueries({ queryKey: ["media"] }),
      ]);
    } catch (err) {
      toastError(m.message_delete_failed(), err, { id: "message-delete" });
    }
  }

  return { ...list, messages: list.rows, remove, retry };
}
