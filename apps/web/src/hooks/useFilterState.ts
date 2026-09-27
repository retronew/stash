import { useCallback, useState } from "react";

/** A filter object with patch-style updates, a reset, and whether anything differs from `empty`. */
export function useFilterState<T extends object>(empty: T) {
  const [filters, setFilters] = useState<T>(empty);
  const set = useCallback((patch: Partial<T>) => setFilters((f) => ({ ...f, ...patch })), []);
  const clear = useCallback(() => setFilters(empty), [empty]);
  return { filters, set, clear, filtered: JSON.stringify(filters) !== JSON.stringify(empty) };
}
