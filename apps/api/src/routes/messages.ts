import { Hono } from "hono";
import { ATTACHMENT_STATUSES, CHAT_TYPES } from "@stash/shared";
import { cursorParam, limitParam, listParam } from "#params";
import type { Env } from "#types";
import { deleteMessage, listMessages } from "#messages";

export const messageRoutes = new Hono<{ Bindings: Env }>();

/**
 * ?before=<id>&limit=&q=<text>&account=<id,id>&chat=c2c,group&media=1&status=failed
 * (lists are comma separated; any value matches).
 */
messageRoutes.get("/", async (c) => {
  const q = c.req.query();
  return c.json(
    await listMessages(c.env.DB, {
      before: cursorParam(q.before),
      limit: limitParam(q.limit, 30),
      query: q.q?.trim() || undefined,
      accountIds: listParam(q.account),
      chatTypes: listParam(q.chat, CHAT_TYPES),
      withMedia: q.media === "1",
      status: ATTACHMENT_STATUSES.find((s) => s === q.status),
    }),
  );
});

messageRoutes.delete("/:id{[0-9]+}", async (c) => {
  const ok = await deleteMessage(c.env.DB, c.env.MEDIA, Number(c.req.param("id")));
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});
