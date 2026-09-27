/** A category for the filter: the configured list first (in its order), then others in use. */
export interface CategoryOption {
  category: string;
  count: number;
}

export function analysisCategoriesFrom(configured: string[], inUse: { category: string; count: number }[]): CategoryOption[] {
  const counts = new Map(inUse.map((c) => [c.category, c.count]));
  const out: CategoryOption[] = configured.map((category) => ({ category, count: counts.get(category) ?? 0 }));
  for (const c of inUse) if (!configured.includes(c.category)) out.push(c);
  return out;
}
