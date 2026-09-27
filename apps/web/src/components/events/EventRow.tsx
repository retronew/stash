import type { Account, WebhookEvent } from "@stash/shared";
import { Badge } from "#components/ui/badge";
import { BotAvatar } from "#components/BotAvatar";
import { accountLabel } from "#components/AccountSelect";
import { outcomeLabel, outcomeVariant } from "#lib/labels";
import { eventName } from "#lib/event-names";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  event: WebhookEvent;
  account: Account | undefined;
  onOpen: (event: WebhookEvent) => void;
}

/** One webhook call; the row opens its details and raw payload. */
export function EventRow({ event, account, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors hover:bg-accent/40"
    >
      <BotAvatar account={account} platform={event.platform} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex items-center gap-2 text-sm">
          <span className="truncate">{eventName(event.platform, event.eventType)}</span>
          <span className="truncate text-muted-foreground text-xs">
            {account ? accountLabel(account) : m.events_unknown_bot()}
          </span>
        </p>
        <p className="truncate text-muted-foreground text-xs">
          {event.eventType && <span className="font-mono">{event.eventType}</span>}
          {event.eventType && event.detail && " · "}
          {event.detail}
        </p>
      </div>
      <Badge variant={outcomeVariant(event.outcome)} className="shrink-0">
        {outcomeLabel(event.outcome)}
      </Badge>
      <time
        className="w-16 shrink-0 text-end text-muted-foreground text-xs max-sm:hidden"
        title={formatDateTime(event.receivedAt)}
      >
        {formatRelative(event.receivedAt)}
      </time>
    </button>
  );
}
