import { isLocale, type Locale } from "@stash/shared/i18n";
import { getSetting, setSetting } from "#settings";

// The owner's interface language, stored server-side so other devices follow it.
// null until chosen; the web app then records the browser's language.

export async function getLocale(db: D1Database): Promise<Locale | null> {
  const value = await getSetting(db, "locale");
  return isLocale(value) ? value : null;
}

export async function setLocale(db: D1Database, locale: Locale) {
  await setSetting(db, "locale", locale);
}
