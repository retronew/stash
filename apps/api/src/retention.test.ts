import { describe, expect, it } from "vitest";
import { prune } from "./retention";

const DAY = 86_400_000;

describe("prune", () => {
  it("deletes AI usage rows past the window, and nothing when kept forever", async () => {
    const calls: { sql: string; values: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          run: async () => (calls.push({ sql, values }), { meta: { changes: 3 } }),
        }),
      }),
    } as unknown as D1Database;
    const before = Date.now();
    expect(await prune(db, {} as R2Bucket, "ai_usage", 30)).toBe(3);
    expect(calls[0].sql).toMatch(/DELETE FROM ai_usage WHERE .* created_at < \?/);
    const cutoff = calls[0].values[0] as number;
    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * DAY);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - 30 * DAY);

    expect(await prune(db, {} as R2Bucket, "ai_usage", 0)).toBe(0);
    expect(calls).toHaveLength(1);
  });
});
