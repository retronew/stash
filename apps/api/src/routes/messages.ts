import { Hono } from "hono";
import type { AttachmentStatus } from "@stash/shared";
import type { Env } from "#types";
import { deleteMessage, listMessages } from "#messages";

export const messageRoutes = new Hono<{ Bindings: Env }>();

const STATUSES: AttachmentStatus[] = ["pending", "downloading", "stored", "failed"];
const MAX_LIMIT = 100;

/** ?before=<id>&limit=&account=<id>&media=1&status=failed */
messageRoutes.get("/", async (c) => {
  const q = c.req.query();
  const before = Number(q.before);
  const limit = Math.min(Math.max(Number(q.limit) || 30, 1), MAX_LIMIT);
  const status = STATUSES.find((s) => s === q.status);
  return c.json(
    await listMessages(c.env.DB, {
      before: Number.isInteger(before) && before > 0 ? before : undefined,
      limit,
      accountId: q.account || undefined,
      withMedia: q.media === "1",
      status,
    }),
  );
});

messageRoutes.delete("/:id{[0-9]+}", async (c) => {
  const ok = await deleteMessage(c.env.DB, c.env.MEDIA, Number(c.req.param("id")));
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});
