// Every server read the app caches, as TanStack Query options. Hooks and
// pages read through these, and invalidate by the same keys after a write.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { Account, AttachmentStatus, MediaStats, MessagePage } from "@stash/shared";
import { api } from "#lib/api";

export interface AllowedEmails {
  owners: string[];
  emails: string[];
}

export interface AccountList {
  /** Public origin the webhook URLs start with. */
  origin: string;
  accounts: Account[];
}

export interface MessageFilters {
  account?: string;
  /** Only messages with attachments. */
  media?: boolean;
  status?: AttachmentStatus;
}

const PAGE_SIZE = 30;

function messagesUrl(filters: MessageFilters, before: number | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (before) params.set("before", String(before));
  if (filters.account) params.set("account", filters.account);
  if (filters.media) params.set("media", "1");
  if (filters.status) params.set("status", filters.status);
  return `/api/messages?${params}`;
}

export const messagesQuery = (filters: MessageFilters) =>
  infiniteQueryOptions({
    queryKey: ["messages", filters],
    queryFn: ({ pageParam }) => api<MessagePage>(messagesUrl(filters, pageParam)),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const mediaStatsQuery = queryOptions({
  queryKey: ["media", "stats"],
  queryFn: () => api<MediaStats>("/api/media/stats"),
});

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: () => api<AccountList>("/api/accounts"),
});

export const allowedEmailsQuery = queryOptions({
  queryKey: ["settings", "allowed-emails"],
  queryFn: () => api<AllowedEmails>("/api/settings/allowed-emails"),
});
