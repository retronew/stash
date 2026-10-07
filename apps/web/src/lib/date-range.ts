/** since / until in ms for the API, from inclusive local dates. */
export function dateRange(from: string, to: string): { since?: number; until?: number } {
  const day = (d: string) => new Date(`${d}T00:00:00`).getTime();
  return {
    since: from ? day(from) : undefined,
    until: to ? day(to) + 86_400_000 : undefined,
  };
}
