import { useQueryClient } from "@tanstack/react-query";
import { api, toastError, toastSuccess } from "#lib/api";
import { m } from "#lib/i18n";

/** Queues failed downloads again (these ids, or every failed one) and refreshes the views. */
export function useMediaRetry() {
  const queryClient = useQueryClient();

  return async function retry(ids?: number[]) {
    try {
      const { queued } = await api<{ queued: number }>("/api/media/retry", { json: ids ? { ids } : {} });
      toastSuccess(m.media_retry_queued({ count: queued }), { id: "media-retry" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
        queryClient.invalidateQueries({ queryKey: ["media"] }),
      ]);
    } catch (err) {
      toastError(m.media_retry_failed(), err, { id: "media-retry" });
    }
  };
}
