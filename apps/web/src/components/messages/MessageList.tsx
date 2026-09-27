import type { ReactNode } from "react";
import type { Account, Message } from "@stash/shared";
import { MessageCard } from "#components/messages/MessageCard";
import { MediaViewer } from "#components/messages/MediaViewer";
import { EditLabelsDialog } from "#components/messages/EditLabelsDialog";
import { Confirm } from "#components/Confirm";
import { m } from "#lib/i18n";
import { MessageMenuItems } from "#components/messages/MessageMenuItems";

export interface MessageActions {
  remove: (id: number) => Promise<void>;
  retry: (ids: number[]) => Promise<void>;
  analyze: (id: number) => Promise<void>;
  setLabels: (id: number, labels: { category: string; tags: string[] }) => Promise<void>;
}

interface Props {
  messages: Message[];
  accounts: Account[];
  /** Offered when editing a message's category. */
  categories: string[];
  actions: MessageActions;
  /** Rendered after the cards, e.g. "load more". */
  children?: ReactNode;
}

/** Message cards with their actions (retry downloads, analyze, edit labels, move to the recycle bin). */
export function MessageList({ messages, accounts, categories, actions, children }: Props) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  async function confirmDelete(message: Message) {
    const ok = await Confirm.call({
      title: m.message_delete_title(),
      message: m.message_delete_message(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (ok) await actions.remove(message.id);
  }

  return (
    <div className="grid animate-fade-in gap-3">
      {messages.map((msg) => (
        <MessageCard
          key={msg.id}
          message={msg}
          account={accountById.get(msg.accountId)}
          onOpen={(attachment) => MediaViewer.call({ attachment })}
          onRetry={(id) => actions.retry([id])}
          menu={
            <MessageMenuItems
              message={msg}
              onAnalyze={() => actions.analyze(msg.id)}
              onEditLabels={() =>
                EditLabelsDialog.call({ message: msg, categories, onSave: (labels) => actions.setLabels(msg.id, labels) })
              }
              onDelete={() => confirmDelete(msg)}
            />
          }
        />
      ))}
      {children}
    </div>
  );
}
