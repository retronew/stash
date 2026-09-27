import type { Env } from "#types";

// Smaller copies of each stored image, made once with the Images binding
// (free plan: 5,000 unique transformations a month) and kept in R2:
//   thumbs/<id>.webp    480px, for lists
//   previews/<id>.webp  1280px, sent to the AI model instead of the original
// Made by the queue right after a download (and by the sweep for older
// images); the outcome is recorded on the attachment (thumb_status / thumb_error).
// Without them, lists show the original and analysis uses the original if small enough.

const SIZES = {
  thumb: { prefix: "thumbs", size: 480, quality: 75 },
  preview: { prefix: "previews", size: 1280, quality: 80 },
} as const;
export type ThumbSize = keyof typeof SIZES;

/** The Images binding takes inputs up to 70 MB. */
const MAX_SOURCE_BYTES = 70 * 1024 * 1024;

export const thumbKey = (attachmentId: number, size: ThumbSize = "thumb") =>
  `${SIZES[size].prefix}/${attachmentId}.webp`;

/** Every derived key of an image, for deleting it with the original. */
export const derivedKeys = (attachmentId: number) =>
  (Object.keys(SIZES) as ThumbSize[]).map((size) => thumbKey(attachmentId, size));

export type ThumbStatus = "" | "done" | "failed" | "skipped";

/**
 * Makes both sizes from the original and records the outcome. Never throws:
 * a failure leaves lists and analysis on the original.
 */
export async function makeThumbs(env: Env, attachmentId: number, r2Key: string): Promise<ThumbStatus> {
  let status: ThumbStatus = "done";
  let error = "";
  if (!env.IMAGES) {
    status = "skipped";
    error = "no Images binding";
  } else {
    try {
      const head = await env.MEDIA.head(r2Key);
      if (!head) throw new Error("original missing in R2");
      if (head.size > MAX_SOURCE_BYTES) {
        status = "skipped";
        error = `original too large (${head.size} bytes)`;
      } else {
        for (const size of Object.keys(SIZES) as ThumbSize[]) {
          const spec = SIZES[size];
          // Streamed from R2 each time: buffering a large original first loses the connection to Images.
          const source = await env.MEDIA.get(r2Key);
          if (!source) throw new Error("original missing in R2");
          const result = await env.IMAGES.input(source.body)
            .transform({ width: spec.size, height: spec.size, fit: "scale-down" })
            .output({ format: "image/webp", quality: spec.quality });
          const out = await new Response(result.image()).arrayBuffer();
          await env.MEDIA.put(thumbKey(attachmentId, size), out, { httpMetadata: { contentType: "image/webp" } });
        }
      }
    } catch (err) {
      status = "failed";
      error = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      console.warn("thumbnails failed", attachmentId, error);
    }
  }
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
