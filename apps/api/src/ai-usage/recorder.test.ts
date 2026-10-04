import { describe, expect, it, vi } from "vitest";
import { embed, generateText, streamText, wrapEmbeddingModel, wrapLanguageModel } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { fallbackModel } from "#ai-fallback";
import { chatUsageMiddleware, embeddingUsageMiddleware, type UsageContext } from "./recorder";

/** A D1 stand-in that keeps the bound values of every INSERT. */
function fakeDb() {
  const rows: unknown[][] = [];
  const db = {
    prepare: () => ({ bind: (...values: unknown[]) => ({ run: async () => void rows.push(values) }) }),
  } as unknown as D1Database;
  return { db, rows };
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

// Columns after created_at: kind, feature, provider, model, input, output, reasoning, cached, ok, error.
const columns = (row: unknown[]) => row.slice(1);

function chat(ctx: UsageContext, model: MockLanguageModelV4, name = "m") {
  return wrapLanguageModel({ model, middleware: chatUsageMiddleware(ctx, { provider: "p", model: name }) });
}

describe("usage middleware", () => {
  it("records a generated reply", async () => {
    const { db, rows } = fakeDb();
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({ content: [{ type: "text", text: "hi" }], finishReason: { unified: "stop", raw: "stop" }, usage: usage(5, 2), warnings: [] }),
    });
    await generateText({ model: chat({ db, feature: "analyze" }, model), prompt: "x" });
    expect(rows.map(columns)).toEqual([["chat", "analyze", "p", "m", 5, 2, 0, 0, 1, null]]);
  });

  it("records a stream once it finishes", async () => {
    const { db, rows } = fakeDb();
    const chunks: LanguageModelV4StreamPart[] = [
      { type: "text-start", id: "1" },
      { type: "text-delta", id: "1", delta: "Hi" },
      { type: "text-end", id: "1" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: usage(7, 3) },
    ];
    const model = new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks }) }) });
    const result = streamText({ model: chat({ db, feature: "analyze" }, model), prompt: "x" });
    expect(await result.text).toBe("Hi");
    expect(rows.map(columns)).toEqual([["chat", "analyze", "p", "m", 7, 3, 0, 0, 1, null]]);
  });

  it("records a failed attempt, then the endpoint that answered", async () => {
    const { db, rows } = fakeDb();
    const ctx: UsageContext = { db, feature: "analyze" };
    const broken = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("bad key"); } });
    const working = new MockLanguageModelV4({
      doGenerate: async () => ({ content: [{ type: "text", text: "ok" }], finishReason: { unified: "stop", raw: "stop" }, usage: usage(4, 1), warnings: [] }),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = fallbackModel([chat(ctx, broken, "a") as never, chat(ctx, working, "b") as never]);
    await generateText({ model, prompt: "x", maxRetries: 0 });
    expect(rows.map(columns)).toEqual([
      ["chat", "analyze", "p", "a", 0, 0, 0, 0, 0, "bad key"],
      ["chat", "analyze", "p", "b", 4, 1, 0, 0, 1, null],
    ]);
  });

  it("records embedding tokens", async () => {
    const { db, rows } = fakeDb();
    const model = wrapEmbeddingModel({
      model: new MockEmbeddingModelV4({ doEmbed: async () => ({ embeddings: [[1, 0]], usage: { tokens: 9 }, warnings: [] }) }),
      middleware: embeddingUsageMiddleware({ db, feature: "search" }, { provider: "", model: "e" }),
    });
    await embed({ model, value: "x" });
    expect(rows.map(columns)).toEqual([["embedding", "search", "custom", "e", 9, 0, 0, 0, 1, null]]);
  });

  it("never fails the call when the row can't be written", async () => {
    const db = { prepare: () => { throw new Error("D1 down"); } } as unknown as D1Database;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({ content: [{ type: "text", text: "hi" }], finishReason: { unified: "stop", raw: "stop" }, usage: usage(1, 1), warnings: [] }),
    });
    const { text } = await generateText({ model: chat({ db, feature: "test" }, model), prompt: "x" });
    expect(text).toBe("hi");
  });
});
