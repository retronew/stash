// QQ Bot webhook signatures: Ed25519 with a key derived from the bot secret.
// https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/sign.html
//
// The seed is the secret repeated until it is at least 32 bytes, cut to 32.
// WebCrypto can't import a raw seed, so it is wrapped in a PKCS#8 header.

const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export function seedFromSecret(secret: string): Uint8Array {
  let seed = new TextEncoder().encode(secret);
  if (seed.length === 0) throw new Error("empty bot secret");
  while (seed.length < 32) {
    const doubled = new Uint8Array(seed.length * 2);
    doubled.set(seed);
    doubled.set(seed, seed.length);
    seed = doubled;
  }
  return seed.slice(0, 32);
}

export async function keyPairFromSeed(seed: Uint8Array): Promise<KeyPair> {
  const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + 32);
  pkcs8.set(PKCS8_ED25519_PREFIX);
  pkcs8.set(seed, PKCS8_ED25519_PREFIX.length);
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  // The JWK export of a private key carries the public key as `x`.
  const { x } = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", x },
    { name: "Ed25519" },
    true,
    ["verify"],
  );
  return { privateKey, publicKey };
}

// Per isolate; deriving the keys costs a few WebCrypto calls per request otherwise.
const cache = new Map<string, Promise<KeyPair>>();

function keysFor(secret: string): Promise<KeyPair> {
  let keys = cache.get(secret);
  if (!keys) {
    keys = keyPairFromSeed(seedFromSecret(secret));
    cache.set(secret, keys);
    keys.catch(() => cache.delete(secret));
  }
  return keys;
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array | null {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Hex signature of `message`, for the callback URL validation (op 13). */
export async function sign(secret: string, message: string): Promise<string> {
  const { privateKey } = await keysFor(secret);
  return toHex(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(message)));
}

/** Checks X-Signature-Ed25519 over X-Signature-Timestamp + body. */
export async function verify(secret: string, signatureHex: string, timestamp: string, body: string): Promise<boolean> {
  const signature = fromHex(signatureHex);
  if (!signature || signature.length !== 64) return false;
  const { publicKey } = await keysFor(secret);
  return crypto.subtle.verify("Ed25519", publicKey, signature, new TextEncoder().encode(timestamp + body));
}
