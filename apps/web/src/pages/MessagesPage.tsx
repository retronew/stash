import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { PageLoading } from "#components/PageLoading";
import { Confirm } from "#components/Confirm";
import { MediaViewer } from "#components/messages/MediaViewer";
import { MediaStatsBar } from "#components/messages/MediaStatsBar";
import { EditLabelsDialog } from "#components/messages/EditLabelsDialog";
import { MessageList } from "#components/messages/MessageList";
import { SearchBox } from "#components/messages/SearchBox";
import { SearchResults } from "#components/messages/SearchResults";
import { EMPTY_MESSAGE_FILTERS, MessagesFilterBar } from "#components/messages/MessagesFilterBar";
import { ExportDialog } from "#components/export/ExportDialog";
import { useFilterState } from "#hooks/useFilterState";
import { useMessages } from "#hooks/useMessages";
import { useMessageSearch } from "#hooks/useMessageSearch";
import { useAccounts } from "#hooks/useAccounts";
import { useAnalysis } from "#hooks/useAnalysis";
import { useMessageSelection } from "#hooks/useMessageSelection";
import { BulkActionBar } from "#components/messages/BulkActionBar";
import type { LabelPick } from "#components/messages/MessageInsights";
import { TagsEditDialog } from "#components/messages/TagsEditDialog";
import { analysisCategoriesFrom } from "#lib/categories";
import { categoriesQuery, chatsQuery, tagsQuery } from "#lib/queries";
import { exportFromFilters } from "#lib/export-plan";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

export function MessagesPage() {
  const { filters, set, clear, filtered } = useFilterState(EMPTY_MESSAGE_FILTERS);
  const [text, setText] = useState("");
  const { accounts } = useAccounts();
  const { data: chats } = useQuery(chatsQuery);
  const { data: inUse } = useQuery(categoriesQuery);
  const { data: tags } = useQuery(tagsQuery);
  const { settings } = useAnalysis();
  const categories = analysisCategoriesFrom(settings?.categories ?? [], inUse ?? []);
  const feed = useMessages(filters);
  const search = useMessageSearch(text, filters);
  // Selection works on whatever is shown: search results or the feed.
  const shown = search.active ? search.hits : feed.messages;
  // Every tag in use, most used first, not just those on the cards shown.
  const allTags = (tags ?? []).map((t) => t.tag);
  const selection = useMessageSelection(shown, allTags);
  const categoryNames = categories.map((c) => c.category);
  // A category or tag clicked on a card joins the filters.
  const pickLabel = (label: LabelPick) =>
    "category" in label
      ? set({ categories: [...new Set([...filters.categories, label.category])] })
      : set({ tags: [...new Set([...filters.tags, label.tag])] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-lg font-semibold">{m.nav_messages()}</h1>
        <MediaStatsBar />
      </div>
      <SearchBox value={text} onChange={setText} busy={search.typing || (search.active && search.isLoading)} />
      <MessagesFilterBar
        filters={filters}
        onChange={set}
        onClear={clear}
        accounts={accounts ?? []}
        chats={chats ?? []}
        categories={categories}
        tags={tags ?? []}
        onExport={() => ExportDialog.call({ initial: exportFromFilters(filters) })}
        selectMode={selection.selectMode}
        onToggleSelectMode={selection.selectMode ? selection.exit : selection.start}
      />

      {selection.selectMode && <BulkActionBar selection={selection} categories={categoryNames} />}

      {search.active ? (
        <SearchResults search={search} accounts={accounts ?? []} categories={categoryNames} actions={feed} selection={selection} onPickLabel={pickLabel} />
      ) : feed.isLoading ? (
        <PageLoading />
      ) : feed.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(feed.error) })}</p>
      ) : feed.messages.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{filtered ? m.list_empty_filtered() : m.messages_empty()}</EmptyTitle>
            <EmptyDescription>
              {filtered ? (
                m.list_empty_filtered_hint()
              ) : accounts?.length === 0 ? (
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
        <MessageList
          messages={feed.messages}
          accounts={accounts ?? []}
          categories={categoryNames}
          actions={feed}
          selection={selection}
          onPickLabel={pickLabel}
          onEndReached={() => feed.hasMore && !feed.loadingMore && feed.loadMore()}
        >
          <LoadMoreButton hasMore={feed.hasMore} loading={feed.loadingMore} onLoadMore={feed.loadMore} />
        </MessageList>
      )}
      <Confirm />
      <MediaViewer />
      <EditLabelsDialog />
      <ExportDialog />
      <TagsEditDialog />
    </div>
  );
}
