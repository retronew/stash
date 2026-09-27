import type { Env } from "#types";

/** The public origin links should use: BETTER_AUTH_URL when set, else the request's own. */
export function publicOrigin(env: Env, requestUrl: string): string {
  try {
    if (env.BETTER_AUTH_URL) return new URL(env.BETTER_AUTH_URL).origin;
  } catch {
    // fall through
  }
  return new URL(requestUrl).origin;
}
