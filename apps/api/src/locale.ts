import { baseLocale, isLocale, type Locale } from "@stash/shared/i18n";
import { getSetting, setSetting } from "#settings";

// The owner's interface language (null until chosen; the web app then records
// the browser's) and the language AI writes in ("auto" = the interface
// language). Stored server-side so other devices and AI jobs know them.

export type AiLanguage = Locale | "auto";

export async function getLocale(db: D1Database): Promise<Locale | null> {
  const value = await getSetting(db, "locale");
  return isLocale(value) ? value : null;
}

export async function setLocale(db: D1Database, locale: Locale) {
  await setSetting(db, "locale", locale);
}

export function isAiLanguage(value: unknown): value is AiLanguage {
  return value === "auto" || isLocale(value);
}

export async function getAiLanguage(db: D1Database): Promise<AiLanguage> {
  const value = await getSetting(db, "ai_language");
  return isLocale(value) ? value : "auto";
}

export async function setAiLanguage(db: D1Database, language: AiLanguage) {
  await setSetting(db, "ai_language", language);
}

/** The language AI output should be written in. */
export async function aiLocale(db: D1Database): Promise<Locale> {
  const [language, locale] = await Promise.all([getAiLanguage(db), getLocale(db)]);
  return language === "auto" ? (locale ?? baseLocale) : language;
}
