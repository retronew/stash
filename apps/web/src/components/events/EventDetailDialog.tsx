import { useMemo } from "react";
import { createCallable } from "react-call";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "#components/ui/dialog";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { DetailList } from "#components/DetailList";
import { PageLoading } from "#components/PageLoading";
import { accountLabel } from "#lib/labels";
import { useEntered } from "#hooks/useEntered";
import { eventDetailQuery } from "#lib/queries";
import { outcomeLabel, outcomeVariant, platformLabel } from "#lib/labels";
import { eventName } from "#lib/event-names";
import { formatDateTime } from "#lib/format";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";
import type { Account } from "@stash/shared";

interface Props {
  id: number;
  account: Account | undefined;
}

/** Pretty-printed JSON, or the text as it came. */
function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** One webhook call: what happened to it, and the body the platform sent. */
export const EventDetailDialog = createCallable<Props, void>(({ id, account, call }) => {
  const entered = useEntered();
  const { data: e, error } = useQuery(eventDetailQuery(id));
  const body = useMemo(() => (e ? pretty(e.raw) : ""), [e]);

  return (
    <Dialog open={entered && !call.ended} onOpenChange={(open) => !open && call.end()}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{e ? eventName(e.platform, e.eventType) : m.event_detail()}</span>
            {e && <Badge variant={outcomeVariant(e.outcome)}>{outcomeLabel(e.outcome)}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {error && <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(error) })}</p>}
          {!e && !error && <PageLoading />}
          {e && (
            <>
              <DetailList
                items={[
                  { label: m.event_type(), value: e.eventType, mono: true },
                  { label: m.event_received(), value: formatDateTime(e.receivedAt) },
                  { label: m.event_bot(), value: account ? accountLabel(account) : m.events_unknown_bot() },
                  { label: m.event_platform(), value: platformLabel(e.platform) },
                  { label: m.event_detail_reason(), value: e.detail },
                  { label: m.event_message_id(), value: e.messageId ? String(e.messageId) : "", mono: true },
                ]}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{m.event_raw()}</span>
                  {e.raw && <CopyButton text={e.raw} aria-label={m.action_copy()} />}
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-5">
                  {body || m.event_raw_empty()}
                </pre>
              </div>
            </>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button onClick={() => call.end()}>{m.action_close()}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}, 200);
