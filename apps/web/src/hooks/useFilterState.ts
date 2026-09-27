import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

type FilterValue = string | string[];

/**
 * A filter object kept in the URL (as PickIt does), so it survives reloads and
 * can be linked: one query parameter per non-default field, lists comma separated.
 * Patch-style updates, a reset, and whether anything differs from `empty`.
 */
export function useFilterState<T extends { [K in keyof T]: FilterValue }>(empty: T) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const out = { ...empty };
    for (const key of Object.keys(empty) as (keyof T & string)[]) {
      const raw = params.get(key);
      if (raw === null) continue;
      out[key] = (Array.isArray(empty[key]) ? raw.split(",").filter(Boolean) : raw) as T[typeof key];
    }
    return out;
  }, [params, empty]);

  const write = useCallback(
    (next: T) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          for (const key of Object.keys(empty) as (keyof T & string)[]) {
            const value = next[key];
            if (JSON.stringify(value) === JSON.stringify(empty[key])) out.delete(key);
            else out.set(key, Array.isArray(value) ? value.join(",") : value);
          }
          return out;
        },
        { replace: true },
      ),
    [empty, setParams],
  );

  const set = useCallback((patch: Partial<T>) => write({ ...filters, ...patch }), [filters, write]);
  const clear = useCallback(() => write(empty), [empty, write]);
  return { filters, set, clear, filtered: JSON.stringify(filters) !== JSON.stringify(empty) };
}
