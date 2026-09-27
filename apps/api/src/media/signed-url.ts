import type { Env } from "#types";

// Short-lived public links to one stored file, for a third-party image
// service (media/thumbs.ts falls back to wsrv.nl) that can't sign in.
// The link is /api/public/media/<id>?exp=<ms>&sig=<HMAC-SHA256 of "id.exp">,
// keyed with BETTER_AUTH_SECRET.

/** Long enough for the service to fetch and process a large original. */
const TTL_MS = 15 * 60_000;

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A public URL for attachment `id`, valid for 15 minutes; null without a public origin. */
export async function signedMediaUrl(env: Env, id: number, now = Date.now()): Promise<string | null> {
  if (!env.BETTER_AUTH_URL || !env.BETTER_AUTH_SECRET) return null;
  const exp = now + TTL_MS;
  const sig = await hmac(env.BETTER_AUTH_SECRET, `${id}.${exp}`);
  return `${new URL(env.BETTER_AUTH_URL).origin}/api/public/media/${id}?exp=${exp}&sig=${sig}`;
}

/** Whether `exp` and `sig` are a valid, unexpired signature for attachment `id`. */
export async function verifyMediaSignature(env: Env, id: number, exp: string | undefined, sig: string | undefined, now = Date.now()) {
  const expires = Number(exp);
  if (!env.BETTER_AUTH_SECRET || !sig || !Number.isFinite(expires) || expires < now) return false;
  const expected = await hmac(env.BETTER_AUTH_SECRET, `${id}.${expires}`);
  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
