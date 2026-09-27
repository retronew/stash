import { createCallable } from "react-call";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, RotateCwIcon } from "lucide-react";
import { attachmentUrl } from "@stash/shared";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "#components/ui/dialog";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { DetailList } from "#components/DetailList";
import { PageLoading } from "#components/PageLoading";
import { useEntered } from "#hooks/useEntered";
import { taskDetailQuery } from "#lib/queries";
import { kindLabel, statusLabel, statusVariant } from "#lib/labels";
import { formatBytes, formatDateTime } from "#lib/format";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

interface Props {
  id: number;
  onRetry: (id: number) => Promise<void>;
}

/** Everything about one download: preview, sizes, attempts, error, links. */
export const TaskDetailDialog = createCallable<Props, void>(({ id, onRetry, call }) => {
  const entered = useEntered();
  const { data: t, error, refetch } = useQuery(taskDetailQuery(id));

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end()}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{t?.filename || (t ? kindLabel(t.kind) : m.task_detail())}</span>
            {t && <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {error && <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(error) })}</p>}
          {!t && !error && <PageLoading />}
          {t && (
            <>
              {t.status === "stored" && t.kind === "image" && (
                <img src={attachmentUrl(t.id)} alt={t.filename} className="mx-auto max-h-72 rounded-lg object-contain" />
              )}
              {t.status !== "stored" && t.lastError && (
                <p className="rounded-lg bg-destructive/8 px-3 py-2 text-destructive-foreground text-sm">{t.lastError}</p>
              )}
              <DetailList
                items={[
                  { label: m.task_kind(), value: kindLabel(t.kind) },
                  { label: m.task_content_type(), value: t.contentType, mono: true },
                  { label: m.task_declared_size(), value: t.size ? formatBytes(t.size) : "" },
                  { label: m.task_stored_size(), value: t.storedSize ? formatBytes(t.storedSize) : "" },
                  { label: m.task_dimensions(), value: t.width && t.height ? `${t.width}×${t.height}` : "" },
                  { label: m.task_attempts(), value: String(t.attempts) },
                  { label: m.task_next_retry(), value: t.nextRetryAt ? formatDateTime(t.nextRetryAt) : "" },
                  { label: m.task_created(), value: formatDateTime(t.createdAt) },
                  { label: m.task_updated(), value: formatDateTime(t.updatedAt) },
                  { label: m.task_stored_at(), value: t.storedAt ? formatDateTime(t.storedAt) : "" },
                  { label: m.task_sender(), value: t.senderName },
                  { label: m.task_message(), value: t.text },
                  {
                    label: m.task_source_url(),
                    mono: true,
                    value: (
                      <span className="inline-flex items-start gap-1">
                        <span className="line-clamp-3">{t.sourceUrl}</span>
                        <CopyButton text={t.sourceUrl} aria-label={m.action_copy()} />
                      </span>
                    ),
                  },
                  { label: m.task_r2_key(), value: t.r2Key ?? "", mono: true },
                ]}
              />
            </>
          )}
        </DialogPanel>
        <DialogFooter>
          {t?.status === "failed" && (
            <Button
              variant="outline"
              onClick={async () => {
                await onRetry(t.id);
                await refetch();
              }}
            >
              <RotateCwIcon />
              {m.action_retry()}
            </Button>
          )}
          {t?.status === "stored" && (
            <Button variant="outline" render={<a href={attachmentUrl(t.id, true)} />}>
              <DownloadIcon />
              {m.attachment_download()}
            </Button>
          )}
          <Button onClick={() => call.end()}>{m.action_close()}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
