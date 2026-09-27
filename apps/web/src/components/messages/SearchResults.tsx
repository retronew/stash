import type { Account } from "@stash/shared";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { MessageList, type MessageActions } from "#components/messages/MessageList";
import type { useMessageSearch } from "#hooks/useMessageSearch";
import type { MessageSelection } from "#hooks/useMessageSelection";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

interface Props {
  search: ReturnType<typeof useMessageSearch>;
  accounts: Account[];
  categories: string[];
  actions: MessageActions;
  selection?: MessageSelection;
}

/** Search results, best first, with a note on whether semantic search took part. */
export function SearchResults({ search, accounts, categories, actions, selection }: Props) {
  if (search.isLoading) return <PageLoading />;
  if (search.error) return <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(search.error) })}</p>;
  if (search.hits.length === 0) {
    return (
      <Empty className="animate-fade-in">
        <EmptyHeader>
          <EmptyTitle>{m.search_empty()}</EmptyTitle>
          <EmptyDescription>{search.semantic ? m.search_empty_hint() : m.search_empty_hint_keyword()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {m.search_count({ count: search.hits.length })} · {search.semantic ? m.search_mode_hybrid() : m.search_mode_keyword()}
      </p>
      <MessageList messages={search.hits} accounts={accounts} categories={categories} actions={actions} selection={selection} />
    </div>
  );
}
