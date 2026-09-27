import { Hono } from "hono";
import type { Env } from "#types";
import { stats } from "#stats";

/** Mounted at /api/stats. ?tz=<UTC offset in minutes> so days break where the viewer's do. */
export const statsRoutes = new Hono<{ Bindings: Env }>();

statsRoutes.get("/", async (c) => {
  const tz = Number(c.req.query("tz"));
  return c.json(await stats(c.env.DB, Number.isInteger(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0));
});
