// SHA-256 of a file, computed while it streams (no extra read of the upload),
// or afterwards from R2 for files stored before hashing existed.

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Passes the bytes through; `hash` resolves once the stream has ended. */
export function hashing(body: ReadableStream<Uint8Array>): { stream: ReadableStream<Uint8Array>; hash: Promise<string> } {
  const digest = new crypto.DigestStream("SHA-256");
  const writer = digest.getWriter();
  const stream = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, ctl) {
        await writer.write(chunk);
        ctl.enqueue(chunk);
      },
      async flush() {
        await writer.close();
      },
    }),
  );
  return { stream, hash: digest.digest.then(toHex) };
}

/** The hash of a stored object; null when it's gone. */
export async function hashObject(bucket: R2Bucket, key: string): Promise<string | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  const digest = new crypto.DigestStream("SHA-256");
  await object.body.pipeTo(digest);
  return toHex(await digest.digest);
}
