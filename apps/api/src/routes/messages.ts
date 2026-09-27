import { Hono } from "hono";
import { cursorParam, limitParam } from "#params";
import { messageQueryParams } from "#message-params";
import type { Env } from "#types";
import { categoryCounts, deleteMessage, getMessage, listChats, listMessages, updateMessageLabels } from "#messages";
import { searchMessages } from "#search";

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

/**
 * Search: ?q= plus the same filters as the list. Keyword and (with an
 * embedding model) semantic matches, best first; no paging.
 */
messageRoutes.get("/search", async (c) => {
  const q = c.req.query();
  const { query: _ignored, ...filter } = messageQueryParams(q);
  return c.json(await searchMessages(c.env, q.q ?? "", filter, limitParam(q.limit, 30, 50)));
});

/** Categories in use, with counts, for the category filter. */
messageRoutes.get("/categories", async (c) => c.json(await categoryCounts(c.env.DB)));

/** body: { category?: string, tags?: string[] } — set by hand. */
messageRoutes.patch("/:id{[0-9]+}", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ category?: unknown; tags?: unknown }>().catch(() => ({}) as Record<string, unknown>);
  const labels: { category?: string; tags?: string[] } = {};
  if (typeof body.category === "string") labels.category = body.category;
  if (Array.isArray(body.tags)) labels.tags = body.tags.filter((t): t is string => typeof t === "string");
  if (!(await updateMessageLabels(c.env.DB, id, labels))) return c.json({ error: "not found" }, 404);
  return c.json(await getMessage(c.env.DB, id));
});

/** The conversations seen so far, for the chat filter. */
messageRoutes.get("/chats", async (c) => c.json(await listChats(c.env.DB)));

messageRoutes.delete("/:id{[0-9]+}", async (c) => {
  const ok = await deleteMessage(c.env.DB, c.env.MEDIA, Number(c.req.param("id")));
  return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});
