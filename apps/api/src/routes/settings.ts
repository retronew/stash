import { Hono } from "hono";
import { isLocale } from "@stash/shared/i18n";
import type { Env } from "#types";
import { ownerEmails, getExtraEmails, setExtraEmails, parseEmails, isValidEmail } from "#auth";
import { getAiLanguage, getLocale, isAiLanguage, setAiLanguage, setLocale } from "#locale";
import { API_TOKEN_KEY, getRawAiSettings, getSetting, saveAiSettings, setSetting } from "#settings";
import {
  normalizeBaseUrl,
  upgradeAiSettings,
  resolveEmbeddingEndpoint,
  findProvider,
  CUSTOM_PROVIDER,
  isChatConfigured,
  isEmbeddingConfigured,
  chatRequestUrls,
  embeddingRequestUrls,
  type AiSettings,
  type AiEndpoint,
} from "@stash/shared";
import { createChatModel, createEmbeddingModel, describeError } from "#ai";
import { listModels, ModelListError, type ModelFamily } from "#ai-models";
import { maskSecret } from "#accounts";
import {
  MAX_RETENTION_DAYS,
  RETENTION_TARGETS,
  isRetentionTarget,
  isValidRetention,
  prune,
  retentionInfo,
  retentionStats,
  setRetentionDays,
} from "#retention";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

// Emails allowed to sign in. Owners (the ALLOWED_EMAILS secret) are read-only
// here; the extra list is stored in the settings table.
settingsRoutes.get("/allowed-emails", async (c) => {
  return c.json({ owners: ownerEmails(c.env), emails: await getExtraEmails(c.env.DB) });
});

settingsRoutes.put("/allowed-emails", async (c) => {
  const body = await c.req.json<{ emails?: unknown }>().catch(() => ({}) as { emails?: unknown });
  if (!Array.isArray(body.emails)) return c.json({ error: "emails must be an array" }, 400);
  const emails = parseEmails(body.emails.filter((e) => typeof e === "string").join(","));
  const invalid = emails.filter((e) => !isValidEmail(e));
  if (invalid.length) return c.json({ error: `invalid: ${invalid.join(", ")}` }, 400);
  const owners = new Set(ownerEmails(c.env));
  const extra = emails.filter((e) => !owners.has(e));
  await setExtraEmails(c.env.DB, extra);
  return c.json({ owners: [...owners], emails: extra });
});

settingsRoutes.get("/locale", async (c) =>
  c.json({ locale: await getLocale(c.env.DB), aiLanguage: await getAiLanguage(c.env.DB) }),
);

/** body: { locale?: "zh" | "en" | "ja", aiLanguage?: "auto" | locale } */
settingsRoutes.put("/locale", async (c) => {
  const body = await c.req.json<{ locale?: unknown; aiLanguage?: unknown }>().catch(() => ({}) as Record<string, unknown>);
  if (body.locale !== undefined && !isLocale(body.locale)) return c.json({ error: "unsupported locale" }, 400);
  if (body.aiLanguage !== undefined && !isAiLanguage(body.aiLanguage)) return c.json({ error: "unsupported aiLanguage" }, 400);
  if (isLocale(body.locale)) await setLocale(c.env.DB, body.locale);
  if (isAiLanguage(body.aiLanguage)) await setAiLanguage(c.env.DB, body.aiLanguage);
  return c.json({ locale: await getLocale(c.env.DB), aiLanguage: await getAiLanguage(c.env.DB) });
});

// API token: `Authorization: Bearer <token>` for scripts (e.g. backing up
// files). Shown once when generated; masked afterwards.

settingsRoutes.get("/api-token", async (c) => {
  const token = await getSetting(c.env.DB, API_TOKEN_KEY);
  return c.json({ masked: token ? maskSecret(token) : null });
});

settingsRoutes.post("/api-token/reset", async (c) => {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await setSetting(c.env.DB, API_TOKEN_KEY, token);
  return c.json({ token });
});

settingsRoutes.delete("/api-token", async (c) => {
  await c.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(API_TOKEN_KEY).run();
  return c.json({ ok: true });
});

// How long events and failed downloads are kept, with current usage.
settingsRoutes.get("/retention", async (c) => {
  const entries = await Promise.all(RETENTION_TARGETS.map(async (t) => [t, await retentionInfo(c.env.DB, t)] as const));
  return c.json({ maxDays: MAX_RETENTION_DAYS, targets: Object.fromEntries(entries) });
});

/** body: { days } (0 = forever). Prunes right away, so a shorter window takes effect now. */
settingsRoutes.put("/retention/:target", async (c) => {
  const target = c.req.param("target");
  if (!isRetentionTarget(target)) return c.json({ error: "unknown target" }, 404);
  const body = await c.req.json<{ days?: unknown }>().catch(() => ({}) as { days?: unknown });
  if (!isValidRetention(body.days)) return c.json({ error: `days must be 0–${MAX_RETENTION_DAYS}` }, 400);
  await setRetentionDays(c.env.DB, target, body.days);
  const deleted = await prune(c.env.DB, target, body.days);
  return c.json({ days: body.days, deleted, stats: await retentionStats(c.env.DB, target) });
});

// AI models (from PickIt). Keys are masked when read; an empty key in the form
// keeps the saved one while the endpoint still points at the same server.

function maskKey(key: string): string {
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
function keepKey<P extends string>(incoming: AiEndpoint<P>, saved: AiEndpoint<P>): string {
  if (incoming.apiKey) return incoming.apiKey;
  const target = origin(incoming.baseUrl);
  const sameTarget = incoming.provider === saved.provider && target !== null && target === origin(saved.baseUrl);
  return sameTarget ? saved.apiKey : "";
}

function mergeWithSaved(body: unknown, saved: AiSettings): AiSettings {
  const next = upgradeAiSettings({ ...(body as object), version: 2 });
  next.chat.baseUrl = normalizeBaseUrl(next.chat.baseUrl);
  next.embedding.baseUrl = normalizeBaseUrl(next.embedding.baseUrl);
  next.chat.apiKey = keepKey(next.chat, saved.chat);
  next.embedding.apiKey = keepKey(next.embedding, saved.embedding);
  return next;
}

settingsRoutes.get("/ai", async (c) => {
  const s = await getRawAiSettings(c.env.DB);
  return c.json({
    chat: { ...s.chat, apiKey: "", apiKeyMasked: maskKey(s.chat.apiKey) },
    embedding: { ...s.embedding, apiKey: "", apiKeyMasked: maskKey(s.embedding.apiKey) },
    chatConfigured: isChatConfigured(s),
    embeddingConfigured: isEmbeddingConfigured(s),
  });
});

settingsRoutes.post("/ai", async (c) => {
  const next = mergeWithSaved(await c.req.json(), await getRawAiSettings(c.env.DB));
  await saveAiSettings(c.env.DB, next);
  return c.json({ ok: true, chatConfigured: isChatConfigured(next), embeddingConfigured: isEmbeddingConfigured(next) });
});

settingsRoutes.post("/ai/models", async (c) => {
  const body = await c.req.json<{ target: "chat" | "embedding"; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawAiSettings(c.env.DB));
  const endpoint = body.target === "chat" ? next.chat : next.embedding;
  if (!endpoint.baseUrl) return c.json({ error: "Enter the base URL first" }, 400);
  if (!endpoint.apiKey && endpoint.provider !== CUSTOM_PROVIDER && !findProvider(endpoint.provider)?.keyOptional) {
    return c.json({ error: "Enter the API key first" }, 400);
  }
  const family: ModelFamily =
    endpoint.protocol === "anthropic" ? "anthropic" : endpoint.protocol === "google" ? "google" : "openai";
  try {
    return c.json(await listModels(family, endpoint.baseUrl, endpoint.apiKey));
  } catch (e) {
    return c.json({ error: e instanceof ModelListError ? e.message : describeError(e) }, 400);
  }
});

settingsRoutes.post("/ai/test", async (c) => {
  const body = await c.req.json<{ target: "chat" | "embedding"; settings: unknown }>();
  const next = mergeWithSaved(body.settings, await getRawAiSettings(c.env.DB));

  if (body.target === "chat") {
    const e = next.chat;
    const urls = chatRequestUrls(e.protocol, e.baseUrl, e.model);
    if (!isChatConfigured(next)) return c.json({ ok: false, urls, error: "The chat model isn't fully set up" });
    try {
      const { generateText } = await import("ai");
      const { text } = await generateText({
        model: createChatModel(e),
        prompt: "Reply with: ok",
        maxOutputTokens: 16, // the Responses API requires >= 16
        maxRetries: 0,
      });
      return c.json({ ok: true, urls, reply: text.slice(0, 100) });
    } catch (err) {
      return c.json({ ok: false, urls, error: describeError(err) });
    }
  }

  const e = resolveEmbeddingEndpoint(next);
  const urls = e ? embeddingRequestUrls(e.protocol, e.baseUrl, e.model) : [];
  if (!e || !isEmbeddingConfigured(next)) return c.json({ ok: false, urls, error: "The embedding model isn't fully set up" });
  try {
    const { embed } = await import("ai");
    const { embedding } = await embed({ model: createEmbeddingModel(e), value: "test", maxRetries: 0 });
    return c.json({ ok: true, urls, dimensions: embedding.length });
  } catch (err) {
    return c.json({ ok: false, urls, error: describeError(err) });
  }
});
