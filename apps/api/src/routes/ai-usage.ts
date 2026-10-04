import { Hono } from "hono";
import type { Env } from "#types";
import { AI_USAGE_RANGES, isValidTimeZone } from "@stash/shared";
import { usageReport } from "#ai-usage/index";

// AI token usage for the Stats page. Retention is one of the generic
// targets (PUT /api/settings/retention/ai_usage), pruned by the retention task.
export const aiUsageRoutes = new Hono<{ Bindings: Env }>();

/** Usage over the last `days` local days in `tz` (an IANA zone, default UTC). */
aiUsageRoutes.get("/", async (c) => {
  const days = Number(c.req.query("days"));
  const tz = c.req.query("tz");
  const range = (AI_USAGE_RANGES as readonly number[]).includes(days) ? days : 30;
  return c.json(await usageReport(c.env.DB, range, isValidTimeZone(tz) ? tz : "UTC"));
});
