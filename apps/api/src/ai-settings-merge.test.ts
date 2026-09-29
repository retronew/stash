import { describe, expect, it } from "vitest";
import { upgradeAiSettings } from "@stash/shared";
import { mergeWithSaved } from "./ai-settings-merge";

const endpoint = (id: string, host: string, apiKey: string) => ({
  id,
  provider: "custom",
  baseUrl: `https://${host}/v1`,
  apiKey,
  protocol: "openai-chat",
  model: "m",
});

describe("mergeWithSaved", () => {
  it("keeps each fallback's key when the order changes", () => {
    const saved = upgradeAiSettings({
      version: 2,
      chat: endpoint("a", "a.example.com", "sk-aaaa-111111"),
      chatFallbacks: [endpoint("b", "b.example.com", "sk-bbbb-222222")],
    });
    const next = mergeWithSaved(
      { chat: endpoint("b", "b.example.com", ""), chatFallbacks: [endpoint("a", "a.example.com", "")], embedding: {} },
      saved,
    );
    expect(next.chat.id).toBe("b");
    expect(next.chat.apiKey).toBe("sk-bbbb-222222");
    expect(next.chatFallbacks[0].apiKey).toBe("sk-aaaa-111111");
  });

  it("drops the saved key when an endpoint moves to another server", () => {
    const saved = upgradeAiSettings({ version: 2, chat: endpoint("a", "a.example.com", "sk-aaaa-111111") });
    const next = mergeWithSaved({ chat: endpoint("a", "evil.example.com", ""), embedding: {} }, saved);
    expect(next.chat.apiKey).toBe("");
  });
});
