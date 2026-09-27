import { Hono } from "hono";
import { cursorParam, limitParam } from "#params";
import { messageQueryParams } from "#message-params";
import type { Env } from "#types";
import {
  categoryCounts,
  tagCounts,
  editTags,
  setCategory,
  getMessage,
  listChats,
  listMessages,
  purgeMessages,
  restoreMessages,
  trashedIds,
  trashMessages,
  updateMessageLabels,
} from "#messages";
import { searchMessages } from "#search";

export const messageRoutes = new Hono<{ Bindings: Env }>();

/**
 * ?before=<id>&limit= plus the shared message filters (see message-params.ts):
 * q, platform, account, chat, since, until, media=1, status; trash=1 lists the recycle bin.
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

/** Tags in use, with counts, for the tag filter. */
messageRoutes.get("/tags", async (c) => c.json(await tagCounts(c.env.DB)));

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

const BULK_ACTIONS = ["trash", "restore", "purge", "category", "add_tags", "remove_tags"] as const;

/**
 * body: { ids: number[], action, category?, tags? } — the selection's bulk
 * actions, as in PickIt. Returns how many messages changed.
 */
messageRoutes.post("/bulk", async (c) => {
  const body = await c.req
    .json<{ ids?: unknown; action?: unknown; category?: unknown; tags?: unknown }>()
    .catch(() => ({}) as Record<string, unknown>);
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)).slice(0, 1000) : [];
  const action = BULK_ACTIONS.find((a) => a === body.action);
  if (!action || ids.length === 0) return c.json({ error: "ids and a valid action are required" }, 400);
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
  const db = c.env.DB;
  const changed =
    action === "trash"
      ? await trashMessages(db, ids)
      : action === "restore"
        ? await restoreMessages(db, ids)
        : action === "purge"
          ? await purgeMessages(db, c.env.MEDIA, ids)
          : action === "category"
            ? await setCategory(db, ids, typeof body.category === "string" ? body.category : "")
            : await editTags(db, ids, tags, action === "add_tags" ? "add" : "remove");
  return c.json({ changed });
});

/** Moves a message to the recycle bin; its files stay until it's purged. */
messageRoutes.delete("/:id{[0-9]+}", async (c) => {
  const n = await trashMessages(c.env.DB, [Number(c.req.param("id"))]);
  return n ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

messageRoutes.post("/:id{[0-9]+}/restore", async (c) => {
  const n = await restoreMessages(c.env.DB, [Number(c.req.param("id"))]);
  return n ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

/** Deletes a message in the recycle bin for good, with its files in R2. */
messageRoutes.delete("/:id{[0-9]+}/purge", async (c) => {
  const n = await purgeMessages(c.env.DB, c.env.MEDIA, [Number(c.req.param("id"))]);
  return n ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
});

/** Empties the recycle bin (in rounds, so a large bin fits one request's limits). */
messageRoutes.post("/trash/empty", async (c) => {
  let purged = 0;
  for (let round = 0; round < 10; round++) {
    const ids = await trashedIds(c.env.DB, undefined, 500);
    if (ids.length === 0) break;
    purged += await purgeMessages(c.env.DB, c.env.MEDIA, ids);
  }
  const left = (await trashedIds(c.env.DB, undefined, 1)).length > 0;
  return c.json({ purged, done: !left });
});
