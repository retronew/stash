import { PencilIcon, Trash2Icon } from "lucide-react";
import type { Account } from "@stash/shared";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { CopyButton } from "#components/CopyButton";
import { AvatarPicker } from "#components/settings/accounts/AvatarPicker";
import { webhookUrl } from "#hooks/useAccounts";
import { platformLabel } from "#lib/labels";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  account: Account;
  origin: string;
  onEdit: () => void;
  onDelete: () => void;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
}

export function AccountRow({ account, origin, onEdit, onDelete, onUploadAvatar, onRemoveAvatar }: Props) {
  const url = webhookUrl(origin, account);
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <AvatarPicker account={account} onUpload={onUploadAvatar} onRemove={onRemoveAvatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{account.name || account.appId}</span>
            <Badge variant="secondary">{platformLabel(account.platform)}</Badge>
            {account.enabled ? (
              <Badge variant="success">{m.account_enabled()}</Badge>
            ) : (
              <Badge variant="warning">{m.account_disabled()}</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {m.account_message_count({ count: account.messageCount })}
            {" · "}
            <span title={account.lastEventAt ? formatDateTime(account.lastEventAt) : undefined}>
              {m.account_last_event()}{" "}
              {account.lastEventAt ? formatRelative(account.lastEventAt) : m.account_never()}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
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
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <dt className="text-muted-foreground">App ID</dt>
        <dd className="truncate font-mono">{account.appId}</dd>
        <dt className="text-muted-foreground">App Secret</dt>
        <dd className="truncate font-mono">{account.appSecretMasked || "—"}</dd>
        <dt className="self-center text-muted-foreground">{m.account_webhook_url()}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono">{url}</span>
          <CopyButton text={url} aria-label={m.account_copy_webhook()} />
        </dd>
      </dl>
    </div>
  );
}
