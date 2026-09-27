import type { StatsSummary } from "@stash/shared";

/** The last `days` days (YYYY-MM-DD, local time), oldest first, with 0 for days without messages. */
export function lastDays(byDay: StatsSummary["byDay"], days = 30, now = new Date()): { label: string; count: number }[] {
  const counts = new Map(byDay.map((d) => [d.day, d.count]));
  const out: { label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ label: key.slice(5), count: counts.get(key) ?? 0 });
  }
  return out;
}

/** The viewer's UTC offset in minutes (UTC+8 → 480), for /api/stats. */
export const tzOffset = () => -new Date().getTimezoneOffset();
