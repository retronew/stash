import { describe, expect, it } from "vitest";
import { TOKEN_URL, verifyQQCredentials } from "./credentials";

const reply = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("verifyQQCredentials", () => {
  it("asks for an AppAccessToken with appId and clientSecret", async () => {
    let sent: { url: string; body: unknown } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return Response.json({ access_token: "t", expires_in: "7200" });
    }) as unknown as typeof fetch;
    expect(await verifyQQCredentials("1024", "s3cret", fetcher)).toEqual({ ok: true });
    expect(sent).toEqual({ url: TOKEN_URL, body: { appId: "1024", clientSecret: "s3cret" } });
  });

  it("passes QQ's error message and code through", async () => {
    const res = await verifyQQCredentials("1", "x", reply(200, JSON.stringify({ code: 100016, message: "invalid appid or secret" })));
    expect(res).toEqual({ ok: false, error: "invalid appid or secret (code 100016)" });
  });

  it("reports non-JSON answers and network failures", async () => {
    expect(await verifyQQCredentials("1", "x", reply(502, "Bad Gateway"))).toEqual({ ok: false, error: "Bad Gateway" });
    const down = (async () => {
      throw new Error("connect timeout");
    }) as unknown as typeof fetch;
    expect(await verifyQQCredentials("1", "x", down)).toEqual({ ok: false, error: "could not reach QQ: connect timeout" });
  });
});
