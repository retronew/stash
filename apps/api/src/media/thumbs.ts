import type { Env } from "#types";

// One medium-sized copy of each stored image (previews/<id>.webp, 1280px),
// made once and kept in R2: lists show it, and the AI model gets it instead
// of the original. Made with the Images binding (free plan: 5,000 unique transformations a
// month); when that fails (it drops very large originals), with the free
// wsrv.nl service, which fetches the original through a short-lived signed
// link (media/signed-url.ts). Made by the queue right after a download (and
// by the sweep for older images); the outcome is recorded on the attachment
// (thumb_status / thumb_error). Without them, lists show the original and
// analysis uses the original if small enough.

import { signedMediaUrl } from "#media/signed-url";

const SPEC = { size: 1280, quality: 80 };
type Spec = typeof SPEC;

/** The Images binding takes inputs up to 70 MB. */
const MAX_IMAGES_BYTES = 70 * 1024 * 1024;
/** wsrv.nl's defaults: 100 MiB and 71 megapixels per image, 10 s to process. */
const MAX_WSRV_BYTES = 100 * 1024 * 1024;
const WSRV = "https://wsrv.nl/";
const WSRV_TIMEOUT_MS = 90_000;

export const thumbKey = (attachmentId: number) => `previews/${attachmentId}.webp`;

/** Every derived key of an image, for deleting it with the original (thumbs/ held a small size once). */
export const derivedKeys = (attachmentId: number) => [thumbKey(attachmentId), `thumbs/${attachmentId}.webp`];

export type ThumbStatus = "" | "done" | "failed" | "skipped";

type Maker = (spec: Spec) => Promise<ArrayBuffer>;

/** Cloudflare Images, streaming the original from R2 each time (buffering a large one loses the connection). */
function withImages(env: Env, r2Key: string): Maker {
  return async (spec) => {
    const source = await env.MEDIA.get(r2Key);
    if (!source) throw new Error("original missing in R2");
    const result = await env.IMAGES!.input(source.body)
      .transform({ width: spec.size, height: spec.size, fit: "scale-down" })
      .output({ format: "image/webp", quality: spec.quality });
    return new Response(result.image()).arrayBuffer();
  };
}

/** wsrv.nl, fetching the original through a signed link. */
function withWsrv(sourceUrl: string): Maker {
  return async (spec) => {
    const url = new URL(WSRV);
    url.search = new URLSearchParams({
      url: sourceUrl,
      w: String(spec.size),
      h: String(spec.size),
      fit: "inside",
      we: "",
      output: "webp",
      q: String(spec.quality),
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(WSRV_TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) {
      const body = await res.text().catch(() => "");
      throw new Error(`wsrv.nl ${res.status}: ${body.slice(0, 150)}`);
    }
    return res.arrayBuffer();
  };
}

async function makeAll(env: Env, attachmentId: number, make: Maker) {
  const out = await make(SPEC);
  await env.MEDIA.put(thumbKey(attachmentId), out, { httpMetadata: { contentType: "image/webp" } });
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Makes the preview from the original and records the outcome. Never throws:
 * a failure leaves lists and analysis on the original.
 */
export async function makeThumbs(env: Env, attachmentId: number, r2Key: string): Promise<ThumbStatus> {
  let status: ThumbStatus = "done";
  const errors: string[] = [];
  try {
    const head = await env.MEDIA.head(r2Key);
    if (!head) throw new Error("original missing in R2");
    let done = false;
    if (env.IMAGES && head.size <= MAX_IMAGES_BYTES) {
      try {
        await makeAll(env, attachmentId, withImages(env, r2Key));
        done = true;
      } catch (err) {
        errors.push(`Images: ${message(err)}`);
      }
    }
    if (!done) {
      const link = head.size <= MAX_WSRV_BYTES ? await signedMediaUrl(env, attachmentId) : null;
      if (link) {
        try {
          await makeAll(env, attachmentId, withWsrv(link));
          done = true;
        } catch (err) {
          errors.push(message(err));
        }
      } else {
        errors.push(head.size > MAX_WSRV_BYTES ? `original too large (${head.size} bytes)` : "no public URL for wsrv.nl");
      }
    }
    if (!done) status = head.size > MAX_WSRV_BYTES ? "skipped" : "failed";
  } catch (err) {
    status = "failed";
    errors.push(message(err));
  }
  // On success, a note that Images failed and wsrv.nl stepped in.
  const error = errors.join("; ").slice(0, 300);
  if (errors.length) console.warn("thumbnails", status, attachmentId, error);
  await env.DB.prepare("UPDATE attachments SET thumb_status = ?, thumb_error = ? WHERE id = ?")
    .bind(status, error, attachmentId)
    .run()
    .catch((err) => console.error("thumbnail status not recorded", attachmentId, err));
  return status;
}

/** Stored images without thumbnails yet (older than the feature, or lost jobs). */
export async function imagesWithoutThumbs(env: Env, limit: number): Promise<number[]> {
  const { results } = await env.DB.prepare(
    "SELECT id FROM attachments WHERE kind = 'image' AND status = 'stored' AND thumb_status = '' ORDER BY id DESC LIMIT ?",
  )
    .bind(limit)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}
