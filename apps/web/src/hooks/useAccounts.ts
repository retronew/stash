import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, Platform } from "@stash/shared";
import { api } from "#lib/api";
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

  return {
    origin: query.data?.origin ?? window.location.origin,
    accounts: query.data?.accounts ?? null,
    error: query.error,
    create,
    update,
    remove,
  };
}

/** The URL to paste into the platform's console. */
export function webhookUrl(origin: string, account: Pick<Account, "platform" | "webhookKey">): string {
  return `${origin}/api/webhooks/${account.platform}/${account.webhookKey}`;
}
