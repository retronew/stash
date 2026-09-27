import { DEFAULT_CATEGORIES, type AnalysisSettings } from "@stash/shared";
import { getSetting, setSetting } from "#settings";

const KEY = "analysis_settings";

export const DEFAULTS: AnalysisSettings = {
  auto: true,
  dailyLimit: 200,
  categories: DEFAULT_CATEGORIES,
  maxImages: 4,
};

export const MAX_CATEGORIES = 50;

/** Stored settings over the defaults; bad values fall back to them. */
export async function getAnalysisSettings(db: D1Database): Promise<AnalysisSettings> {
  const value = await getSetting(db, KEY);
  let raw: Partial<AnalysisSettings> = {};
  try {
    raw = value ? (JSON.parse(value) as Partial<AnalysisSettings>) : {};
  } catch {
    // Corrupt: defaults.
  }
  return sanitize({ ...DEFAULTS, ...raw });
}

export function sanitize(s: Partial<AnalysisSettings>): AnalysisSettings {
  const int = (v: unknown, fallback: number, min: number, max: number) =>
    Number.isInteger(v) ? Math.min(max, Math.max(min, v as number)) : fallback;
  const categories = Array.isArray(s.categories)
    ? [...new Set(s.categories.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 30)).filter(Boolean))]
    : DEFAULTS.categories;
  return {
    auto: typeof s.auto === "boolean" ? s.auto : DEFAULTS.auto,
    dailyLimit: int(s.dailyLimit, DEFAULTS.dailyLimit, 0, 100_000),
    categories: categories.slice(0, MAX_CATEGORIES),
    maxImages: int(s.maxImages, DEFAULTS.maxImages, 0, 10),
  };
}

export async function saveAnalysisSettings(db: D1Database, s: Partial<AnalysisSettings>): Promise<AnalysisSettings> {
  const next = sanitize({ ...(await getAnalysisSettings(db)), ...s });
  await setSetting(db, KEY, JSON.stringify(next));
  return next;
}
