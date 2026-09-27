import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { m } from "#lib/i18n";

interface Props {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

/** "Load more" at the end of a paged list; nothing once the list is complete. */
export function LoadMoreButton({ hasMore, loading, onLoadMore }: Props) {
  if (!hasMore) return null;
  return (
    <Button variant="outline" className="mx-auto" disabled={loading} onClick={onLoadMore}>
      {loading && <Spinner />}
      {m.action_load_more()}
    </Button>
  );
}
