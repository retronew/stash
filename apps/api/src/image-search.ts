import { normalizeImageSearchSettings, type ImageSearchSettings } from "@stash/shared";
import { getSetting, setSetting } from "#settings";

// Reverse image search settings (which engines, what the button does).
// The search itself happens in the browser, with a signed link from routes/media.ts.

const KEY = "image_search";

export async function getImageSearchSettings(db: D1Database): Promise<ImageSearchSettings> {
  const value = await getSetting(db, KEY);
  try {
    return normalizeImageSearchSettings(value ? JSON.parse(value) : null);
  } catch {
    return normalizeImageSearchSettings(null);
  }
}

export async function saveImageSearchSettings(db: D1Database, body: unknown): Promise<ImageSearchSettings> {
  const next = normalizeImageSearchSettings(body);
  await setSetting(db, KEY, JSON.stringify(next));
  return next;
}
