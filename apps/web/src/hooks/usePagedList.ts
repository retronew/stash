import { useMemo } from "react";
import { useInfiniteQuery, type InfiniteData, type QueryKey, type UseInfiniteQueryOptions } from "@tanstack/react-query";

type Options<Page, Key extends QueryKey> = UseInfiniteQueryOptions<Page, Error, InfiniteData<Page>, Key, number | null>;

export interface PagedListOptions<Item> {
  /** Keep refetching every `ms` while this returns true for the loaded rows (e.g. downloads in flight). */
  pollWhile?: (rows: Item[]) => boolean;
  /** Live mode: refetch every `ms` regardless. */
  live?: boolean;
  ms?: number;
}

/**
 * A cursor-paged list as one flat array, with live polling and a manual
 * refresh. `items` picks the rows out of a page.
 */
export function usePagedList<Page, Item, Key extends QueryKey>(
  options: Options<Page, Key>,
  items: (page: Page) => Item[],
  { pollWhile, live = false, ms = 5000 }: PagedListOptions<Item> = {},
) {
  const query = useInfiniteQuery({
    ...options,
    refetchInterval: (q) => (live || pollWhile?.(q.state.data?.pages.flatMap(items) ?? []) ? ms : false),
  });
  const rows = useMemo(() => query.data?.pages.flatMap(items) ?? [], [query.data, items]);

  return {
    rows,
    isLoading: query.isPending,
    error: query.error,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
    refresh: () => query.refetch(),
    /** A refetch the user can see (not the first load, not "load more"). */
    refreshing: query.isRefetching && !query.isFetchingNextPage,
    updatedAt: query.dataUpdatedAt || null,
  };
}
