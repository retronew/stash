import { Hono } from "hono";
import type { Env } from "#types";
import { EVENT_OUTCOMES } from "@stash/shared";
import { eventStats, eventTypeCounts, getEvent, listEvents } from "#events";
import { cursorParam, limitParam, listParam } from "#params";

/** The webhook event log, mounted at /api/events. */
export const eventRoutes = new Hono<{ Bindings: Env }>();

/** ?before=<id>&limit=&account=a,b&hit=1|0&outcome=a,b&type=a,b (lists: any value matches). */
eventRoutes.get("/", async (c) => {
  const q = c.req.query();
  return c.json(
    await listEvents(c.env.DB, {
      before: cursorParam(q.before),
      limit: limitParam(q.limit, 50),
      accountIds: listParam(q.account),
      hit: q.hit === "1" ? true : q.hit === "0" ? false : undefined,
      outcomes: listParam(q.outcome, EVENT_OUTCOMES),
      eventTypes: listParam(q.type),
    }),
  );
});

/** Event types seen in the log, with counts, for the filter. */
eventRoutes.get("/types", async (c) => c.json(await eventTypeCounts(c.env.DB)));

/** ?hours= (default 24, at most 30 days) */
eventRoutes.get("/stats", async (c) => {
  const hours = Math.min(Math.max(Number(c.req.query("hours")) || 24, 1), 24 * 30);
  return c.json(await eventStats(c.env.DB, hours));
});

eventRoutes.get("/:id{[0-9]+}", async (c) => {
  const event = await getEvent(c.env.DB, Number(c.req.param("id")));
  return event ? c.json(event) : c.json({ error: "not found" }, 404);
});
