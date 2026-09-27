import { describe, expect, it } from "vitest";
import { fromHex, keyPairFromSeed, seedFromSecret, sign, toHex, verify } from "./signature";

describe("seedFromSecret", () => {
  it("repeats the secret until it is 32 bytes", () => {
    expect(new TextDecoder().decode(seedFromSecret("abc"))).toBe("abcabcabcabcabcabcabcabcabcabcab");
  });

  it("cuts long secrets to 32 bytes", () => {
    expect(seedFromSecret("x".repeat(40))).toHaveLength(32);
  });
});

describe("keyPairFromSeed", () => {
  it("derives the RFC 8032 test vector public key", async () => {
    const seed = fromHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")!;
    const { publicKey } = await keyPairFromSeed(seed);
    const raw = await crypto.subtle.exportKey("raw", publicKey);
    expect(toHex(raw as ArrayBuffer)).toBe("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
  });
});

describe("sign / verify", () => {
  const secret = "naOC0ocQE3shWLAfffVLB1rhYPG7";

  it("verifies its own signature over timestamp + body", async () => {
    const body = '{"op":0,"t":"C2C_MESSAGE_CREATE"}';
    const signature = await sign(secret, "1725442341" + body);
    expect(await verify(secret, signature, "1725442341", body)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and malformed signatures", async () => {
    const signature = await sign(secret, "1" + "body");
    expect(await verify(secret, signature, "1", "bodY")).toBe(false);
    expect(await verify("another-secret", signature, "1", "body")).toBe(false);
    expect(await verify(secret, "zz", "1", "body")).toBe(false);
    expect(await verify(secret, "", "1", "body")).toBe(false);
  });
});
