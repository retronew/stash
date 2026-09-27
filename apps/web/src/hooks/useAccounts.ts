import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, Platform } from "@stash/shared";
import { api, ApiError } from "#lib/api";
import { m } from "#lib/i18n";
import { accountsQuery } from "#lib/queries";

export interface AccountPayload {
  name: string;
  appId: string;
  /** Empty keeps the saved secret when editing. */
  appSecret: string;
  webhookKey: string;
  enabled: boolean;
}

/** Bot accounts plus create / update / delete; every write refreshes the list. */
export function useAccounts() {
  const queryClient = useQueryClient();
  const query = useQuery(accountsQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey });

  async function create(platform: Platform, payload: AccountPayload) {
    const account = await api<Account>("/api/accounts", { json: { platform, ...payload } });
    await refresh();
    return account;
  }

  async function update(id: string, payload: Partial<AccountPayload>) {
    const account = await api<Account>(`/api/accounts/${id}`, { method: "PATCH", json: payload });
    await refresh();
    return account;
  }

  async function remove(id: string) {
    await api(`/api/accounts/${id}`, { method: "DELETE" });
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["messages"] })]);
  }

  /** Uploads a bot's picture (an image file, at most 2 MB). */
  async function uploadAvatar(id: string, file: File) {
    const res = await fetch(`/api/accounts/${id}/avatar`, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(typeof data.error === "string" ? data.error : m.error_status({ status: res.status }), res.status);
    }
    await refresh();
  }

  async function removeAvatar(id: string) {
    await api(`/api/accounts/${id}/avatar`, { method: "DELETE" });
    await refresh();
  }

  /**
   * Asks the platform whether the credentials are valid. With `id`, an empty
   * secret means the saved one (the form never sees it).
   */
  function verify(input: { platform: Platform; appId: string; appSecret: string; id?: string }) {
    return api<{ ok: true } | { ok: false; error: string }>("/api/accounts/verify", { json: input });
  }

  return {
    origin: query.data?.origin ?? window.location.origin,
    accounts: query.data?.accounts ?? null,
    error: query.error,
    create,
    update,
    remove,
    uploadAvatar,
    removeAvatar,
    verify,
  };
}

/** The URL to paste into the platform's console. */
export function webhookUrl(origin: string, account: Pick<Account, "platform" | "webhookKey">): string {
  return `${origin}/api/webhooks/${account.platform}/${account.webhookKey}`;
}
