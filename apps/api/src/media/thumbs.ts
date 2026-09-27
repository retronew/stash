import type { Env } from "#types";

// List thumbnails: images are shrunk once with the Images binding (free plan:
// 5,000 unique transformations a month) and kept in R2 next to the originals,
// so later views cost nothing. Without the binding, or when it fails (quota,
// odd format), the caller serves the original.

/** Long edge of a thumbnail, px: enough for a 4-column grid on a 2x screen. */
const THUMB_SIZE = 480;
/** Larger originals aren't worth the transformation time; show them as is. */
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

export const thumbKey = (attachmentId: number) => `thumbs/${attachmentId}.webp`;

/** The thumbnail object, made on first request; null means "use the original". */
export async function getThumb(env: Env, attachmentId: number, r2Key: string): Promise<R2ObjectBody | null> {
  const key = thumbKey(attachmentId);
  const cached = await env.MEDIA.get(key);
  if (cached) return cached;
  if (!env.IMAGES) return null;

  const source = await env.MEDIA.get(r2Key);
  if (!source || source.size > MAX_SOURCE_BYTES) {
    await source?.body.cancel();
    return null;
  }
  try {
    const result = await env.IMAGES.input(source.body)
      .transform({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "scale-down" })
      .output({ format: "image/webp", quality: 75 });
    const bytes = await new Response(result.image()).arrayBuffer();
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/webp" } });
    return await env.MEDIA.get(key);
  } catch (err) {
    console.warn("thumbnail failed; serving the original", attachmentId, err);
    return null;
  }
}
