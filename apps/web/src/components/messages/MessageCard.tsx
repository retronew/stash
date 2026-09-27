import type { ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import type { Account, Attachment, Message } from "@stash/shared";
import { Card } from "#components/ui/card";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Menu, MenuPopup, MenuTrigger } from "#components/ui/menu";
import { AttachmentTile } from "#components/messages/AttachmentTile";
import { MessageInsights } from "#components/messages/MessageInsights";
import { BotAvatar } from "#components/BotAvatar";
import { chatTypeLabel, platformLabel } from "#lib/labels";
import { formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  message: Message;
  account: Account | undefined;
  onOpen: (attachment: Attachment) => void;
  onRetry: (id: number) => void;
  /** The "⋯" menu's items (they differ in the recycle bin). */
  menu: ReactNode;
}

export function MessageCard({ message, account, onOpen, onRetry, menu }: Props) {
  return (
    <Card className="gap-3 p-4 shadow-none before:shadow-none dark:before:shadow-none">
      <div className="flex items-center gap-2 text-sm">
        <BotAvatar account={account} platform={message.platform} />
        <Badge variant="secondary">{account?.name || platformLabel(message.platform)}</Badge>
        <span className="text-muted-foreground">{chatTypeLabel(message.chatType)}</span>
        {message.senderName && <span className="truncate">{message.senderName}</span>}
        <time
          dateTime={new Date(message.sentAt).toISOString()}
          title={formatDateTime(message.sentAt)}
          className="ms-auto shrink-0 text-muted-foreground text-xs"
        >
          {formatRelative(message.sentAt)}
        </time>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={m.message_actions()} className="text-muted-foreground" />}>
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            {menu}
          </MenuPopup>
        </Menu>
      </div>
      {message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}
      {message.attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {message.attachments.map((a) => (
            <AttachmentTile key={a.id} attachment={a} onOpen={onOpen} onRetry={onRetry} />
          ))}
        </div>
      )}
      <MessageInsights message={message} />
    </Card>
  );
}
