import { Hono } from "hono";
import type { Env } from "#types";
import { resetForRetry } from "#media/attachments";
import { enqueueDownloads } from "#media/jobs";
import { mediaStats } from "#messages";
import { getTask, listTasks } from "#media/tasks";
import { makeThumbs, thumbKey } from "#media/thumbs";
import { ATTACHMENT_KINDS, ATTACHMENT_STATUSES } from "@stash/shared";
import { cursorParam, limitParam, listParam } from "#params";

export const mediaRoutes = new Hono<{ Bindings: Env }>();

mediaRoutes.get("/stats", async (c) => c.json(await mediaStats(c.env.DB)));

/** Download tasks: ?before=<id>&limit=&status=a,b&kind=a,b&account=a,b (any value matches). */
mediaRoutes.get("/tasks", async (c) => {
  const q = c.req.query();
  return c.json(
    await listTasks(c.env.DB, {
      before: cursorParam(q.before),
      limit: limitParam(q.limit, 50),
      statuses: listParam(q.status, ATTACHMENT_STATUSES),
      kinds: listParam(q.kind, ATTACHMENT_KINDS),
      accountIds: listParam(q.account),
    }),
  );
});

mediaRoutes.get("/tasks/:id{[0-9]+}", async (c) => {
  const task = await getTask(c.env.DB, Number(c.req.param("id")));
  return task ? c.json(task) : c.json({ error: "not found" }, 404);
});

/** body: { ids?: number[] } — retry these failed attachments, or every failed one. */
mediaRoutes.post("/retry", async (c) => {
  const body = await c.req.json<{ ids?: unknown }>().catch(() => ({}) as { ids?: unknown });
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)) : null;
  const reset = await resetForRetry(c.env.DB, ids ?? "failed");
  await enqueueDownloads(c.env, reset);
  return c.json({ queued: reset.length });
});

/**
 * The 1280px WebP preview of a stored image, for lists; the original when one
 * can't be made. /thumb is the old address (browsers cached a smaller size there).
 */
mediaRoutes.get("/:id{[0-9]+}/:kind{preview|thumb}", async (c) => {
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT r2_key, kind, thumb_status FROM attachments WHERE id = ? AND status = 'stored'")
    .bind(id)
    .first<{ r2_key: string; kind: string; thumb_status: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.kind !== "image") return c.redirect(`/api/media/${id}`, 302);
  // Not made yet (an older image the sweep hasn't reached): make it now.
  if (row.thumb_status === "") await makeThumbs(c.env, id, row.r2_key);
  const thumb = await c.env.MEDIA.get(thumbKey(id));
  // Failed or skipped: the original, uncached so a later thumbnail shows up.
  if (!thumb) return c.redirect(`/api/media/${id}`, 302);
  const headers = new Headers();
  thumb.writeHttpMetadata(headers);
  headers.set("ETag", thumb.httpEtag);
  headers.set("Content-Length", String(thumb.size));
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  return new Response(thumb.body, { headers });
});

/** The stored file. Supports Range (video seeking) and conditional requests. */
mediaRoutes.get("/:id{[0-9]+}", async (c) => {
  const row = await c.env.DB.prepare("SELECT r2_key, filename FROM attachments WHERE id = ? AND status = 'stored'")
    .bind(Number(c.req.param("id")))
    .first<{ r2_key: string; filename: string }>();
  if (!row) return c.json({ error: "not found" }, 404);

  const object = await c.env.MEDIA.get(row.r2_key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  // Behind sign-in, and a stored file never changes.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  if (c.req.query("download") === "1") {
    const name = row.filename || row.r2_key.split("/").pop()!;
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  // onlyIf failed: the browser's copy is current.
  if (!("body" in object)) return new Response(null, { status: 304, headers });

  const range = object.range as { offset?: number; length?: number } | undefined;
  if (range && c.req.header("range")) {
    const start = range.offset ?? 0;
    const length = range.length ?? object.size - start;
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
});
