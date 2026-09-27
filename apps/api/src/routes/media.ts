import { Hono } from "hono";
import type { Env } from "#types";
import { resetForRetry } from "#media/attachments";
import { enqueueDownloads } from "#media/jobs";
import { mediaStats } from "#messages";

export const mediaRoutes = new Hono<{ Bindings: Env }>();

mediaRoutes.get("/stats", async (c) => c.json(await mediaStats(c.env.DB)));

/** body: { ids?: number[] } — retry these failed attachments, or every failed one. */
mediaRoutes.post("/retry", async (c) => {
  const body = await c.req.json<{ ids?: unknown }>().catch(() => ({}) as { ids?: unknown });
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)) : null;
  const reset = await resetForRetry(c.env.DB, ids ?? "failed");
  await enqueueDownloads(c.env, reset);
  return c.json({ queued: reset.length });
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
