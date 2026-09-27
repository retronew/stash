import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@stash/shared";
import { api, toastError, toastSuccess } from "#lib/api";
import { messagesQuery, type MessageFilters } from "#lib/queries";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { m } from "#lib/i18n";

/** Attachments still downloading are polled until they settle. */
const POLL_MS = 5000;

/** The message feed for the given filters, with paging, delete and retry. */
export function useMessages(filters: MessageFilters) {
  const queryClient = useQueryClient();
  const retry = useMediaRetry();
  const query = useInfiniteQuery({
    ...messagesQuery(filters),
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) =>
        p.messages.some((msg) => msg.attachments.some((a) => a.status === "pending" || a.status === "downloading")),
      )
        ? POLL_MS
        : false,
  });

  const messages = useMemo<Message[]>(() => query.data?.pages.flatMap((p) => p.messages) ?? [], [query.data]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["messages"] }),
      queryClient.invalidateQueries({ queryKey: ["media"] }),
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


  return {
    messages,
    isLoading: query.isPending,
    error: query.error,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
    remove,
    retry,
  };
}
