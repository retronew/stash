import { Hono } from "hono";
import type { Env } from "#types";
import { OUTCOMES, eventStats, getEvent, listEvents } from "#events";

/** The webhook event log, mounted at /api/events. */
export const eventRoutes = new Hono<{ Bindings: Env }>();

const MAX_LIMIT = 100;

/** ?before=<id>&limit=&account=<id>&hit=1|0&outcome= */
eventRoutes.get("/", async (c) => {
  const q = c.req.query();
  const before = Number(q.before);
  return c.json(
    await listEvents(c.env.DB, {
      before: Number.isInteger(before) && before > 0 ? before : undefined,
      limit: Math.min(Math.max(Number(q.limit) || 50, 1), MAX_LIMIT),
      accountId: q.account || undefined,
      hit: q.hit === "1" ? true : q.hit === "0" ? false : undefined,
      outcome: OUTCOMES.find((o) => o === q.outcome),
    }),
  );
});

/** ?hours= (default 24, at most 30 days) */
eventRoutes.get("/stats", async (c) => {
  const hours = Math.min(Math.max(Number(c.req.query("hours")) || 24, 1), 24 * 30);
  return c.json(await eventStats(c.env.DB, hours));
});

eventRoutes.get("/:id{[0-9]+}", async (c) => {
  const event = await getEvent(c.env.DB, Number(c.req.param("id")));
  return event ? c.json(event) : c.json({ error: "not found" }, 404);
});
