import { CheckSquareIcon, Trash2Icon } from "lucide-react";
import { Button } from "#components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { Confirm } from "#components/Confirm";
import { MediaViewer } from "#components/messages/MediaViewer";
import { MessageCard } from "#components/messages/MessageCard";
import { WindowVirtualList } from "#components/WindowVirtualList";
import { estimateMessageHeight } from "#lib/message-height";
import { TrashMenuItems } from "#components/messages/MessageMenuItems";
import { useTrash } from "#hooks/useTrash";
import { useMessageSelection } from "#hooks/useMessageSelection";
import { BulkActionBar } from "#components/messages/BulkActionBar";
import { useAccounts } from "#hooks/useAccounts";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Deleted messages, kept (files included) until purged by hand or by the retention setting. */
export function TrashPage() {
  const trash = useTrash();
  const selection = useMessageSelection(trash.messages);
  const retry = useMediaRetry();
  const { accounts } = useAccounts();
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  async function purge(id: number) {
    const ok = await Confirm.call({
      title: m.purge_title(),
      message: m.purge_message(),
      confirmLabel: m.action_purge(),
      danger: true,
    });
    if (ok) await trash.purge(id);
  }

  async function emptyAll() {
    const ok = await Confirm.call({
      title: m.empty_trash_title(),
      message: m.empty_trash_message(),
      confirmLabel: m.empty_trash_confirm(),
      danger: true,
    });
    if (ok) await trash.empty();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading font-semibold text-lg">{m.nav_trash()}</h1>
          <p className="text-muted-foreground text-xs">{m.trash_description()}</p>
        </div>
        {trash.messages.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={emptyAll}>
              <Trash2Icon />
              <span className="max-sm:sr-only">{m.empty_trash()}</span>
            </Button>
            <Button
              variant={selection.selectMode ? "default" : "secondary"}
              size="sm"
              onClick={selection.selectMode ? selection.exit : selection.start}
            >
              <CheckSquareIcon />
              <span className="max-sm:sr-only">{m.action_select()}</span>
            </Button>
          </div>
        )}
      </div>

      {selection.selectMode && <BulkActionBar selection={selection} variant="trash" />}

      {trash.isLoading ? (
        <PageLoading />
      ) : trash.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(trash.error) })}</p>
      ) : trash.messages.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.trash_empty()}</EmptyTitle>
            <EmptyDescription>{m.trash_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="animate-fade-in">
          <WindowVirtualList
            rows={trash.messages}
            getKey={(msg) => String(msg.id)}
            estimateSize={estimateMessageHeight}
            onEndReached={() => trash.hasMore && !trash.loadingMore && trash.loadMore()}
            renderRow={(msg) => (
              <div className="pb-3">
                <MessageCard
                  message={msg}
                  account={accountById.get(msg.accountId)}
                  onOpen={(attachment) => MediaViewer.call({ attachment })}
                  onRetry={(id) => retry([id])}
                  selectMode={selection.selectMode}
                  selected={selection.selectedIds.has(msg.id)}
                  onToggleSelect={selection.toggle}
                  menu={<TrashMenuItems onRestore={() => trash.restore(msg.id)} onPurge={() => purge(msg.id)} />}
                />
              </div>
            )}
          />
          <LoadMoreButton hasMore={trash.hasMore} loading={trash.loadingMore} onLoadMore={trash.loadMore} />
        </div>
      )}
      <MediaViewer />
      <Confirm />
    </div>
  );
}
