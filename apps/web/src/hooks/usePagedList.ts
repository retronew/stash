import { useMemo } from "react";
import { useInfiniteQuery, type InfiniteData, type QueryKey, type UseInfiniteQueryOptions } from "@tanstack/react-query";

type Options<Page, Key extends QueryKey> = UseInfiniteQueryOptions<Page, Error, InfiniteData<Page>, Key, number | null>;

/**
 * A cursor-paged list as one flat array. `items` picks the rows out of a page;
 * `poll` keeps refetching while it returns true for the loaded rows.
 */
export function usePagedList<Page, Item, Key extends QueryKey>(
  options: Options<Page, Key>,
  items: (page: Page) => Item[],
  poll?: { while: (rows: Item[]) => boolean; ms: number },
) {
  const query = useInfiniteQuery({
    ...options,
    refetchInterval: poll
      ? (q) => (poll.while(q.state.data?.pages.flatMap(items) ?? []) ? poll.ms : false)
      : undefined,
  });
  const rows = useMemo(() => query.data?.pages.flatMap(items) ?? [], [query.data, items]);

  return {
    rows,
    isLoading: query.isPending,
    error: query.error,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
  };
}
