import { useState } from "react";
import { Link } from "react-router";
import type { Message } from "@stash/shared";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { Confirm } from "#components/Confirm";
import { MessageCard } from "#components/messages/MessageCard";
import { MediaViewer } from "#components/messages/MediaViewer";
import { MediaStatsBar } from "#components/messages/MediaStatsBar";
import { MessagesFilterBar, filtersFor, type MessageView } from "#components/messages/MessagesFilterBar";
import { useMessages } from "#hooks/useMessages";
import { useAccounts } from "#hooks/useAccounts";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

export function MessagesPage() {
  const [view, setView] = useState<MessageView>("all");
  const [account, setAccount] = useState("");
  const { accounts } = useAccounts();
  const feed = useMessages(filtersFor(view, account));
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  async function confirmDelete(message: Message) {
    const ok = await Confirm.call({
      title: m.message_delete_title(),
      message: m.message_delete_message(),
      confirmLabel: m.action_delete(),
      danger: true,
    });
    if (ok) await feed.remove(message.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-lg font-semibold">{m.nav_messages()}</h1>
        <MediaStatsBar onRetryAll={() => feed.retry()} />
      </div>
      <MessagesFilterBar
        view={view}
        onViewChange={setView}
        account={account}
        onAccountChange={setAccount}
        accounts={accounts ?? []}
      />

      {feed.isLoading ? (
        <PageLoading />
      ) : feed.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(feed.error) })}</p>
      ) : feed.messages.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.messages_empty()}</EmptyTitle>
            <EmptyDescription>
              {accounts?.length === 0 ? (
                <>
                  {m.messages_empty_no_account()}{" "}
                  <Link to="/settings" className="underline underline-offset-4">
                    {m.nav_settings()}
                  </Link>
                </>
              ) : (
                m.messages_empty_hint()
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid animate-fade-in gap-3">
          {feed.messages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              account={accountById.get(msg.accountId)}
              onOpen={(attachment) => MediaViewer.call({ attachment })}
              onRetry={(id) => feed.retry([id])}
              onDelete={confirmDelete}
            />
          ))}
          {feed.hasMore && (
            <Button variant="outline" className="mx-auto" disabled={feed.loadingMore} onClick={feed.loadMore}>
              {feed.loadingMore && <Spinner />}
              {m.action_load_more()}
            </Button>
          )}
        </div>
      )}
      <Confirm />
      <MediaViewer />
    </div>
  );
}
