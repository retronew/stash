// Merging a submitted AI settings form with what's saved. The form never
// holds saved keys (they're masked), so an empty key keeps the saved one, but
// only for the same provider and server.

import {
  chatEndpoints,
  normalizeBaseUrl,
  upgradeAiSettings,
  withChatEndpoints,
  type AiEndpoint,
  type AiSettings,
  type ChatEndpoint,
} from "@stash/shared";

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function origin(url: string): string | null {
  try {
    return new URL(normalizeBaseUrl(url)).origin;
  } catch {
    return null;
  }
}

/** An empty key means "keep the saved one", but only for the same provider and server. */
function keepKey<P extends string>(incoming: AiEndpoint<P>, saved: AiEndpoint<P> | undefined): string {
  if (incoming.apiKey || !saved) return incoming.apiKey;
  const target = origin(incoming.baseUrl);
  const sameTarget = incoming.provider === saved.provider && target !== null && target === origin(saved.baseUrl);
  return sameTarget ? saved.apiKey : "";
}

/**
 * The saved chat endpoint an incoming one keeps its key from: the same entry
 * (by id, so reordering is fine), else the first one on the same provider and server.
 */
function savedChatFor(incoming: ChatEndpoint, saved: ChatEndpoint[]): ChatEndpoint | undefined {
  const target = origin(incoming.baseUrl);
  return (
    saved.find((s) => s.id === incoming.id) ??
    saved.find((s) => s.provider === incoming.provider && target !== null && origin(s.baseUrl) === target)
  );
}

export function mergeWithSaved(body: unknown, saved: AiSettings): AiSettings {
  const next = upgradeAiSettings({ ...(body as object), version: 2 });
  const savedChats = chatEndpoints(saved);
  const chats = chatEndpoints(next).map((e) => {
    const chat = { ...e, baseUrl: normalizeBaseUrl(e.baseUrl) };
    return { ...chat, apiKey: keepKey(chat, savedChatFor(chat, savedChats)) };
  });
  next.embedding.baseUrl = normalizeBaseUrl(next.embedding.baseUrl);
  next.embedding.apiKey = keepKey(next.embedding, saved.embedding);
  return withChatEndpoints(next, chats);
}

/** The chat endpoint a models/test request is about (`index` in fallback order). */
export function chatAt(settings: AiSettings, index: unknown): ChatEndpoint | undefined {
  return chatEndpoints(settings)[typeof index === "number" ? index : 0];
}

export const maskChat = (e: ChatEndpoint) => ({ ...e, apiKey: "", apiKeyMasked: maskKey(e.apiKey) });
