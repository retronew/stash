// Query-string helpers shared by the list routes.

/** A positive integer cursor, or undefined. */
export function cursorParam(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** A page size clamped to [1, max]. */
export function limitParam(value: string | undefined, fallback: number, max = 100): number {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

/**
 * A comma-separated list (?status=pending,failed). With `allowed`, unknown
 * values are dropped; an empty result means "no filter".
 */
export function listParam<T extends string>(value: string | undefined, allowed?: readonly T[]): T[] {
  const items = (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 50);
  const unique = [...new Set(items)];
  return (allowed ? unique.filter((v): v is T => (allowed as readonly string[]).includes(v)) : unique) as T[];
}

/** `column IN (?, ?, …)` for a non-empty list; pushes the values onto `params`. */
export function inClause(column: string, values: readonly unknown[], params: unknown[]): string {
  params.push(...values);
  return `${column} IN (${values.map(() => "?").join(", ")})`;
}
