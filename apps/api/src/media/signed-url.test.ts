import { describe, expect, it } from "vitest";
import type { Env } from "#types";
import { signedMediaUrl, verifyMediaSignature } from "#media/signed-url";

const env = { BETTER_AUTH_URL: "https://stash.example.com", BETTER_AUTH_SECRET: "s3cret" } as Env;

describe("signed media links", () => {
  it("verifies its own link until it expires", async () => {
    const now = 1_000_000;
    const url = new URL((await signedMediaUrl(env, 5, now))!);
    expect(url.origin + url.pathname).toBe("https://stash.example.com/api/public/media/5");
    const exp = url.searchParams.get("exp")!;
    const sig = url.searchParams.get("sig")!;
    expect(await verifyMediaSignature(env, 5, exp, sig, now + 1000)).toBe(true);
    expect(await verifyMediaSignature(env, 5, exp, sig, now + 16 * 60_000)).toBe(false);
  });

  it("rejects another id, a changed expiry or another secret", async () => {
    const url = new URL((await signedMediaUrl(env, 5, 0))!);
    const exp = url.searchParams.get("exp")!;
    const sig = url.searchParams.get("sig")!;
    expect(await verifyMediaSignature(env, 6, exp, sig, 0)).toBe(false);
    expect(await verifyMediaSignature(env, 5, String(Number(exp) + 1), sig, 0)).toBe(false);
    expect(await verifyMediaSignature({ ...env, BETTER_AUTH_SECRET: "other" }, 5, exp, sig, 0)).toBe(false);
    expect(await verifyMediaSignature(env, 5, exp, undefined, 0)).toBe(false);
  });

  it("has no link without a public origin", async () => {
    expect(await signedMediaUrl({ BETTER_AUTH_SECRET: "x" } as Env, 1)).toBeNull();
  });
});
