import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchQuery, type MessageFilters } from "#lib/queries";
import { inFlight } from "#hooks/useMessages";

const DEBOUNCE_MS = 350;

/** Search as you type: waits for a pause, keeps the filters, polls while results are still being analyzed. */
export function useMessageSearch(text: string, filters: MessageFilters) {
  const [q, setQ] = useState(text.trim());
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({
    ...searchQuery(q, filters),
    enabled: q.length > 0,
    refetchInterval: (s) => (s.state.data && inFlight(s.state.data.hits) ? 5000 : false),
  });

  return {
    active: q.length > 0,
    /** Typed but not searched yet. */
    typing: text.trim() !== q,
    hits: query.data?.hits ?? [],
    semantic: query.data?.semantic ?? false,
    isLoading: query.isPending && q.length > 0,
    error: query.error,
  };
}
