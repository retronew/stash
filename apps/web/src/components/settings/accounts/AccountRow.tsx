import { PencilIcon, Trash2Icon } from "lucide-react";
import type { Account } from "@stash/shared";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { webhookUrl } from "#hooks/useAccounts";
import { platformLabel } from "#lib/labels";
import { formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  account: Account;
  origin: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountRow({ account, origin, onEdit, onDelete }: Props) {
  const url = webhookUrl(origin, account);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{platformLabel(account.platform)}</Badge>
        <span className="truncate font-medium text-sm">{account.name || account.appId}</span>
        {!account.enabled && <Badge variant="warning">{m.account_disabled()}</Badge>}
        <div className="ms-auto flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-xs" aria-label={m.action_edit()} onClick={onEdit}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.action_delete()}
            className="text-muted-foreground hover:text-destructive-foreground"
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">App ID</dt>
        <dd className="truncate font-mono">{account.appId}</dd>
        <dt className="text-muted-foreground">{m.account_webhook_url()}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono">{url}</span>
          <CopyButton text={url} aria-label={m.account_copy_webhook()} />
        </dd>
        <dt className="text-muted-foreground">{m.account_last_event()}</dt>
        <dd>{account.lastEventAt ? formatRelative(account.lastEventAt) : m.account_never()}</dd>
      </dl>
    </div>
  );
}
