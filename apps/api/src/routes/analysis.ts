import { Hono } from "hono";
import type { AnalysisStats } from "@stash/shared";
import type { Env } from "#types";
import { getAiSettings } from "#settings";
import { getAnalysisSettings, saveAnalysisSettings } from "#analysis/settings";
import { queueByScope, requestAnalysis, type QueueScope } from "#analysis/queue";

/** AI analysis settings, progress and queueing, mounted at /api/analysis. */
export const analysisRoutes = new Hono<{ Bindings: Env }>();

const DAY_MS = 86_400_000;

analysisRoutes.get("/settings", async (c) => c.json(await getAnalysisSettings(c.env.DB)));

/** body: Partial<AnalysisSettings> */
analysisRoutes.put("/settings", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  return c.json(await saveAnalysisSettings(c.env.DB, body));
});

analysisRoutes.get("/stats", async (c) => {
  const now = Date.now();
  const [row, settings, ai] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
         SUM(ai_status IN ('done', 'skipped')) AS done,
         SUM(ai_status IN ('pending', 'running')) AS pending,
         SUM(ai_status = 'failed') AS failed,
         SUM(ai_status = '') AS notAnalyzed,
         SUM(ai_at >= ?) AS today,
         SUM(vec IS NOT NULL) AS embedded
       FROM messages WHERE deleted_at IS NULL`,
    )
      .bind(now - (now % DAY_MS))
      .first<Omit<AnalysisStats, "dailyLimit">>(),
    getAnalysisSettings(c.env.DB),
    getAiSettings(c.env.DB),
  ]);
  const n = (v: number | null | undefined) => v ?? 0;
  const stats: AnalysisStats & { configured: boolean } = {
    total: n(row?.total),
    done: n(row?.done),
    pending: n(row?.pending),
    failed: n(row?.failed),
    notAnalyzed: n(row?.notAnalyzed),
    today: n(row?.today),
    embedded: n(row?.embedded),
    dailyLimit: settings.dailyLimit,
    configured: !!ai,
  };
  return c.json(stats);
});

/** body: { scope: "unanalyzed" | "failed" | "all" } or { ids: number[] } */
analysisRoutes.post("/queue", async (c) => {
  if (!(await getAiSettings(c.env.DB))) return c.json({ error: "Set up an AI model first" }, 400);
  const body = await c.req.json<{ scope?: unknown; ids?: unknown }>().catch(() => ({}) as { scope?: unknown; ids?: unknown });
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((id): id is number => Number.isInteger(id)).slice(0, 1000);
    return c.json({ queued: (await requestAnalysis(c.env, ids)).length });
  }
  const scopes: QueueScope[] = ["unanalyzed", "failed", "all"];
  const scope = scopes.find((s) => s === body.scope);
  if (!scope) return c.json({ error: "scope must be unanalyzed, failed or all" }, 400);
  return c.json({ queued: await queueByScope(c.env, scope) });
});
