// Every server read the app caches, as TanStack Query options. Hooks and
// pages read through these, and invalidate by the same keys after a write.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  Account,
  AttachmentKind,
  AttachmentStatus,
  EventOutcome,
  EventPage,
  EventStats,
  MediaStats,
  MediaTaskDetail,
  MediaTaskPage,
  MessagePage,
  WebhookEventDetail,
} from "@stash/shared";
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

export interface EventFilters {
  account?: string;
  /** true: hits, false: misses. */
  hit?: boolean;
  outcome?: EventOutcome;
}

function listUrl(path: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return `${path}?${search}`;
}

export const eventsQuery = (filters: EventFilters) =>
  infiniteQueryOptions({
    queryKey: ["events", filters],
    queryFn: ({ pageParam }) =>
      api<EventPage>(listUrl("/api/events", { ...filters, before: pageParam, limit: 50 })),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const eventStatsQuery = (hours: number) =>
  queryOptions({
    queryKey: ["events", "stats", hours],
    queryFn: () => api<EventStats>(`/api/events/stats?hours=${hours}`),
  });

export const eventDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ["events", "detail", id],
    queryFn: () => api<WebhookEventDetail>(`/api/events/${id}`),
    staleTime: Infinity,
  });

export interface TaskFilters {
  account?: string;
  status?: AttachmentStatus;
  kind?: AttachmentKind;
}

export const tasksQuery = (filters: TaskFilters) =>
  infiniteQueryOptions({
    queryKey: ["media", "tasks", filters],
    queryFn: ({ pageParam }) =>
      api<MediaTaskPage>(listUrl("/api/media/tasks", { ...filters, before: pageParam, limit: 50 })),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const taskDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ["media", "tasks", "detail", id],
    queryFn: () => api<MediaTaskDetail>(`/api/media/tasks/${id}`),
  });

export const apiTokenQuery = queryOptions({
  queryKey: ["settings", "api-token"],
  queryFn: () => api<{ masked: string | null }>("/api/settings/api-token"),
});
