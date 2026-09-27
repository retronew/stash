import { describe, expect, it } from "vitest";
import { handleMcpPost, handleMessage, SUPPORTED_VERSIONS } from "./server";
import { TOOLS, type ToolContext } from "./tools";

// Protocol-level checks; the tools themselves need D1 and R2.
const ctx = {} as ToolContext;

describe("MCP server", () => {
  it("negotiates the protocol version", async () => {
    const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, ctx);
    expect(res).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", serverInfo: { name: "stash" } } });
    const other = await handleMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, ctx);
    expect(other).toMatchObject({ result: { protocolVersion: SUPPORTED_VERSIONS[0] } });
  });

  it("lists every tool without its implementation", async () => {
    const res = (await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/list" }, ctx)) as { result: { tools: object[] } };
    expect(res.result.tools).toHaveLength(TOOLS.length);
    expect(res.result.tools.every((t) => !("run" in t))).toBe(true);
  });

  it("answers notifications with nothing and bad input with JSON-RPC errors", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx)).toBeNull();
    expect(await handleMessage({ jsonrpc: "2.0", id: 4, method: "nope" }, ctx)).toMatchObject({ error: { code: -32601 } });
    expect(await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }, ctx)).toMatchObject({
      error: { code: -32602 },
    });
    expect((await handleMcpPost("{not json", ctx)).status).toBe(400);
  });
});
