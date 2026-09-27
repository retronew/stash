import type { CredentialCheck } from "#platforms/types";

// https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/api-use.html
// An AppAccessToken is only issued for a valid AppID + AppSecret, so asking
// for one checks the credentials without side effects.
export const TOKEN_URL = "https://api.bot.qq.com/app/getAppAccessToken";

const TIMEOUT_MS = 10_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  code?: number;
  message?: string;
}

export async function verifyQQCredentials(
  appId: string,
  secret: string,
  fetcher: typeof fetch = fetch,
): Promise<CredentialCheck> {
  let res: Response;
  try {
    res = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, clientSecret: secret }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, error: `could not reach QQ: ${err instanceof Error ? err.message : String(err)}` };
  }
  const text = await res.text();
  let body: TokenResponse = {};
  try {
    body = JSON.parse(text) as TokenResponse;
  } catch {
    // Not JSON (e.g. a gateway error page): report the status below.
  }
  if (res.ok && body.access_token) return { ok: true };
  // QQ's own words, e.g. "invalid appid or secret", plus its code.
  const reason = body.message || text.slice(0, 200) || `HTTP ${res.status}`;
  return { ok: false, error: body.code !== undefined ? `${reason} (code ${body.code})` : reason };
}
