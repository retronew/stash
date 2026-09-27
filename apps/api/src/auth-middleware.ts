import type { Context, Next } from "hono";
import type { Env } from "#types";
import { getAuth, isAllowedEmail, isDevBypass } from "#auth";

const PUBLIC_PATHS = new Set(["/api/health"]);
// Webhooks prove who they are with the platform's own signature (see platforms/).
const PUBLIC_PREFIXES = ["/api/public/", "/api/auth/", "/api/webhooks/"];

/** Requires a Better Auth session with an allowed email. */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p)) || isDevBypass(c.env)) {
    await next();
    return;
  }
  const session = await getAuth(c.env)
    .api.getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  // Re-check the allowlist so removing an email revokes existing sessions.
  if (!session || !(await isAllowedEmail(c.env, session.user.email))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}
