import {
  upgradeAiSettings,
  emptyAiSettings,
  isChatConfigured,
  isEmbeddingConfigured,
  type AiSettings,
} from "@stash/shared";

// Key/value rows in the settings table.

// Settings are read on every request (allowlist, API token) but rarely change,
// so each isolate keeps them briefly. Writes here update the cache at once;
// other isolates see a change within CACHE_TTL_MS.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; at: number }>();

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  const value = row?.value ?? null;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
  cache.set(key, { value, at: Date.now() });
}

export async function deleteSetting(db: D1Database, key: string) {
  await db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
  cache.set(key, { value: null, at: Date.now() });
}

/** Settings key of the API token (see routes/settings.ts). */
export const API_TOKEN_KEY = "api_token";

const AI_KEY = "ai_config";

/** The stored AI config (upgraded from older formats), even if incomplete. */
export async function getRawAiSettings(db: D1Database): Promise<AiSettings> {
  const value = await getSetting(db, AI_KEY);
  if (!value) return emptyAiSettings();
  try {
    return upgradeAiSettings(JSON.parse(value));
  } catch {
    return emptyAiSettings();
  }
}

/** The AI config, or null when neither chat nor embedding is usable. */
export async function getAiSettings(db: D1Database): Promise<AiSettings | null> {
  const s = await getRawAiSettings(db);
  return isChatConfigured(s) || isEmbeddingConfigured(s) ? s : null;
}

export async function saveAiSettings(db: D1Database, config: AiSettings) {
  await setSetting(db, AI_KEY, JSON.stringify(config));
}
