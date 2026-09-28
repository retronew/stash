import type { Context, Next } from "hono";
import type { Env } from "#types";
import { getAuth, isAllowedEmail, isDevBypass } from "#auth";
import { API_TOKEN_KEY, getSetting } from "#settings";
import { setActor } from "#audit/index";

const PUBLIC_PATHS = new Set(["/api/health"]);
// Webhooks prove who they are with the platform's own signature (see platforms/).
const PUBLIC_PREFIXES = ["/api/public/", "/api/auth/", "/api/webhooks/"];

/** Requires a Better Auth session with an allowed email, or the API token. */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p)) || isDevBypass(c.env)) {
    if (isDevBypass(c.env)) setActor(c, "dev");
    await next();
    return;
  }
  const bearer = c.req.header("Authorization");
  if (bearer?.startsWith("Bearer ")) {
    const stored = await getSetting(c.env.DB, API_TOKEN_KEY);
    if (stored && bearer.slice(7) === stored) {
      setActor(c, "api-token");
      await next();
      return;
    }
    return c.json({ error: "unauthorized" }, 401);
  }
  const result = await getAuth(c.env)
    .api.getSession({ headers: c.req.raw.headers, returnHeaders: true })
    .catch(() => null);
  const session = result?.response;
  // Re-check the allowlist so removing an email revokes existing sessions.
  if (!session || !(await isAllowedEmail(c.env, session.user.email))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  setActor(c, session.user.email);
  await next();
  // Pass on the refreshed session cookie cache; without it every request
  // after the first five minutes would look the session up in D1 again.
  // (A proxied fetch() response has immutable headers; it just misses the refresh.)
  try {
    for (const cookie of result.headers.getSetCookie()) c.res.headers.append("Set-Cookie", cookie);
  } catch {}
}
