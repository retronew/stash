// Every server read the app caches, as TanStack Query options. Hooks and
// pages read through these, and invalidate by the same keys after a write.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  Account,
  AttachmentKind,
  AttachmentStatus,
  ChatType,
  EventOutcome,
  EventPage,
  EventStats,
  EventTypeCount,
  MediaStats,
  MediaTaskDetail,
  MediaTaskPage,
  MessagePage,
  WebhookEventDetail,
} from "@stash/shared";
import { api } from "#lib/api";

type Param = string | number | boolean | readonly string[] | undefined | null;

/** path?k=v&…, leaving out empty values; lists become comma-separated, booleans 1 / 0. */
function listUrl(path: string, params: Record<string, Param>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    search.set(k, Array.isArray(v) ? v.join(",") : typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return `${path}?${search}`;
}

export interface AllowedEmails {
  owners: string[];
  emails: string[];
}

export interface AccountList {
  /** Public origin the webhook URLs start with. */
  origin: string;
  accounts: Account[];
}

/** Message feed filters; empty lists mean "any". */
export interface MessageFilters {
  accounts: string[];
  chatTypes: ChatType[];
  /** all, only messages with files, or only those with a failed download. */
  media: "all" | "media" | "failed";
}

export const messagesQuery = (filters: MessageFilters) =>
  infiniteQueryOptions({
    queryKey: ["messages", filters],
    queryFn: ({ pageParam }) =>
      api<MessagePage>(
        listUrl("/api/messages", {
          account: filters.accounts,
          chat: filters.chatTypes,
          media: filters.media === "media" ? true : undefined,
          status: filters.media === "failed" ? "failed" : undefined,
          before: pageParam,
          limit: 30,
        }),
      ),
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

/** Event log filters; empty lists mean "any". */
export interface EventFilters {
  accounts: string[];
  hit: "all" | "hit" | "miss";
  outcomes: EventOutcome[];
  types: string[];
}

export const eventsQuery = (filters: EventFilters) =>
  infiniteQueryOptions({
    queryKey: ["events", filters],
    queryFn: ({ pageParam }) =>
      api<EventPage>(
        listUrl("/api/events", {
          account: filters.accounts,
          hit: filters.hit === "all" ? undefined : filters.hit === "hit",
          outcome: filters.outcomes,
          type: filters.types,
          before: pageParam,
          limit: 50,
        }),
      ),
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

/** Task queue filters; empty lists mean "any". */
export interface TaskFilters {
  accounts: string[];
  statuses: AttachmentStatus[];
  kinds: AttachmentKind[];
}

export const tasksQuery = (filters: TaskFilters) =>
  infiniteQueryOptions({
    queryKey: ["media", "tasks", filters],
    queryFn: ({ pageParam }) =>
      api<MediaTaskPage>(
        listUrl("/api/media/tasks", {
          account: filters.accounts,
          status: filters.statuses,
          kind: filters.kinds,
          before: pageParam,
          limit: 50,
        }),
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const taskDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ["media", "tasks", "detail", id],
    queryFn: () => api<MediaTaskDetail>(`/api/media/tasks/${id}`),
  });

export const eventTypesQuery = queryOptions({
  queryKey: ["events", "types"],
  queryFn: () => api<EventTypeCount[]>("/api/events/types"),
});

export const apiTokenQuery = queryOptions({
  queryKey: ["settings", "api-token"],
  queryFn: () => api<{ masked: string | null }>("/api/settings/api-token"),
});
