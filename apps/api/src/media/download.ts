import type { DownloadTarget } from "#media/attachments";
import { DownloadError, isRetryableStatus } from "#media/retry";
import { extensionFor, mediaKey } from "#media/keys";

// Streams an attachment from the platform into R2 without holding it in
// memory, so files of tens (or hundreds) of MB fit in a Worker's 128 MB.
// Waiting on the network doesn't count as CPU time, so the free plan's CPU
// limit isn't the bottleneck; a queue consumer may run for up to 15 minutes.

/** Longest a single download may take before it counts as failed (and is retried). */
const TIMEOUT_MS = 12 * 60_000;
/** Multipart part size (R2 needs >= 5 MB for every part but the last). */
const PART_SIZE = 10 * 1024 * 1024;
/** R2's single-PUT limit is 5 GiB; anything larger goes multipart. */
const SINGLE_PUT_MAX = 5 * 1024 ** 3 - 1024 ** 2;

export interface Stored {
  key: string;
  size: number;
  contentType: string;
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.name === "TimeoutError" ? "download timed out" : err.message;
  return String(err);
}

export async function downloadToR2(bucket: R2Bucket, target: DownloadTarget): Promise<Stored> {
  let res: Response;
  try {
    res = await fetch(target.source_url, {
      // A length we can trust: compressed responses are decoded by fetch and
      // no longer match Content-Length.
      headers: { "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 (compatible; Stash)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new DownloadError(`network error: ${describe(err)}`, true);
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel();
    throw new DownloadError(`HTTP ${res.status}`, isRetryableStatus(res.status));
  }

  const contentType =
    res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ||
    target.content_type ||
    "application/octet-stream";
  // Some CDNs answer an expired link with 200 and an error page.
  if (contentType === "text/html" && target.kind !== "file") {
    await res.body.cancel();
    throw new DownloadError("got a web page instead of the file (link expired?)", false);
  }

  const key = mediaKey(target.platform, target.id, target.received_at, extensionFor(target.filename, contentType));
  const options: R2PutOptions = {
    httpMetadata: { contentType },
    customMetadata: { attachmentId: String(target.id), filename: target.filename },
  };
  const length = Number(res.headers.get("content-length"));
  const encoded = (res.headers.get("content-encoding") ?? "identity").toLowerCase() !== "identity";
  const knownLength = Number.isSafeInteger(length) && length > 0 && !encoded;

  let size: number;
  try {
    size =
      knownLength && length <= SINGLE_PUT_MAX
        ? await putStream(bucket, key, res.body, length, options)
        : await putMultipart(bucket, key, res.body, options);
  } catch (err) {
    throw err instanceof DownloadError ? err : new DownloadError(`transfer failed: ${describe(err)}`, true);
  }

  if (size === 0 || (knownLength && size !== length)) {
    await bucket.delete(key).catch(() => {});
    throw new DownloadError(`incomplete download: ${size} of ${knownLength ? length : "?"} bytes`, true);
  }
  return { key, size, contentType };
}

/** Single PUT, streamed. FixedLengthStream errors if the body ends early. */
async function putStream(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  length: number,
  options: R2PutOptions,
): Promise<number> {
  const { readable, writable } = new FixedLengthStream(length);
  const [object] = await Promise.all([bucket.put(key, readable, options), body.pipeTo(writable)]);
  return object?.size ?? 0;
}

/** Unknown length (or > 5 GiB): upload in fixed-size parts as the bytes arrive. */
async function putMultipart(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  options: R2PutOptions,
): Promise<number> {
  const upload = await bucket.createMultipartUpload(key, options);
  const parts: R2UploadedPart[] = [];
  let buffer = new Uint8Array(PART_SIZE);
  let filled = 0;
  let total = 0;
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let offset = 0;
      while (offset < value.length) {
        const n = Math.min(PART_SIZE - filled, value.length - offset);
        buffer.set(value.subarray(offset, offset + n), filled);
        filled += n;
        offset += n;
        total += n;
        if (filled === PART_SIZE) {
          parts.push(await upload.uploadPart(parts.length + 1, buffer));
          buffer = new Uint8Array(PART_SIZE);
          filled = 0;
        }
      }
    }
    if (total === 0) {
      await upload.abort();
      return 0;
    }
    if (filled > 0) parts.push(await upload.uploadPart(parts.length + 1, buffer.subarray(0, filled)));
    await upload.complete(parts);
    return total;
  } catch (err) {
    await upload.abort().catch(() => {});
    throw err;
  }
}
