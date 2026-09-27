import { Hono } from "hono";
import { ATTACHMENT_KINDS } from "@stash/shared";
import type { Env } from "#types";
import { exportSummary } from "#export";
import { messageQueryParams } from "#message-params";
import { listParam } from "#params";

/** Export support, mounted at /api/export. */
export const exportRoutes = new Hono<{ Bindings: Env }>();

/** Counts for the export dialog: the message filters plus kind=image,video. */
exportRoutes.get("/summary", async (c) => {
  const q = c.req.query();
  return c.json(await exportSummary(c.env.DB, messageQueryParams(q), listParam(q.kind, ATTACHMENT_KINDS)));
});
