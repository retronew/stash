import { useQueryClient } from "@tanstack/react-query";
import type { Message, MessagePage } from "@stash/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { messagesQuery, type MessageFilters } from "#lib/queries";
import { usePagedList } from "#hooks/usePagedList";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { m } from "#lib/i18n";

const messagesOf = (page: MessagePage) => page.messages;

/** Something on the page is still changing on the server: a download or an analysis. */
export const inFlight = (messages: Message[]) =>
  messages.some(
    (msg) =>
      msg.aiStatus === "pending" ||
      msg.aiStatus === "running" ||
      msg.attachments.some((a) => a.status === "pending" || a.status === "downloading"),
  );

/** The message feed for the given filters, with paging and the per-message actions. */
export function useMessages(filters: MessageFilters) {
  const queryClient = useQueryClient();
  const retry = useMediaRetry();
  const list = usePagedList(messagesQuery(filters), messagesOf, { pollWhile: inFlight });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["messages"] }),
      queryClient.invalidateQueries({ queryKey: ["media"] }),
      queryClient.invalidateQueries({ queryKey: ["analysis"] }),
    ]);

  async function remove(id: number) {
    try {
      await api(`/api/messages/${id}`, { method: "DELETE" });
      toastSuccess(m.message_deleted(), { id: "message-delete" });
      await refresh();
    } catch (err) {
      toastError(m.message_delete_failed(), err, { id: "message-delete" });
    }
  }

  /** Queues one message for (re-)analysis. */
  async function analyze(id: number) {
    try {
      await api("/api/analysis/queue", { json: { ids: [id] } });
      toastSuccess(m.message_analyze_queued(), { id: "message-analyze" });
      await refresh();
    } catch (err) {
      toastError(m.analysis_queue_failed(), err, { id: "message-analyze" });
    }
  }

  /** Sets category and tags by hand; throws so the dialog can show the error. */
  async function setLabels(id: number, labels: { category: string; tags: string[] }) {
    await api(`/api/messages/${id}`, { method: "PATCH", json: labels });
    await refresh();
  }

  return { ...list, messages: list.rows, remove, retry, analyze, setLabels };
}
