import { Hono } from "hono";
import { isLocale } from "@stash/shared/i18n";
import type { Env } from "#types";
import { ownerEmails, getExtraEmails, setExtraEmails, parseEmails, isValidEmail } from "#auth";
import { getLocale, setLocale } from "#locale";

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

settingsRoutes.get("/locale", async (c) => c.json({ locale: await getLocale(c.env.DB) }));

/** body: { locale: "zh" | "en" | "ja" } */
settingsRoutes.put("/locale", async (c) => {
  const body = await c.req.json<{ locale?: unknown }>().catch(() => ({}) as { locale?: unknown });
  if (!isLocale(body.locale)) return c.json({ error: "unsupported locale" }, 400);
  await setLocale(c.env.DB, body.locale);
  return c.json({ locale: body.locale });
});
