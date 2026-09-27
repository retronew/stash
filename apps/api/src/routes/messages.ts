import { Hono } from "hono";
import { cursorParam, limitParam } from "#params";
import { messageQueryParams } from "#message-params";
import type { Env } from "#types";
import { deleteMessage, listChats, listMessages } from "#messages";

export const messageRoutes = new Hono<{ Bindings: Env }>();

/**
 * ?before=<id>&limit= plus the shared message filters (see message-params.ts):
 * q, platform, account, chat, since, until, media=1, status.
 */
messageRoutes.get("/", async (c) => {
  const q = c.req.query();
  return c.json(
    await listMessages(c.env.DB, {
      ...messageQueryParams(q),
      before: cursorParam(q.before),
      limit: limitParam(q.limit, 30),
    }),
  );
});

/** The conversations seen so far, for the chat filter. */
messageRoutes.get("/chats", async (c) => c.json(await listChats(c.env.DB)));

messageRoutes.delete("/:id{[0-9]+}", async (c) => {
  const ok = await deleteMessage(c.env.DB, c.env.MEDIA, Number(c.req.param("id")));
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});
