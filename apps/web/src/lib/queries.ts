// Every server read the app caches, as TanStack Query options. Hooks and
// pages read through these, and invalidate by the same keys after a write.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { CronOverview } from "@stash/shared";
import type { BackupInfo } from "#hooks/useBackups";
import type { StatsSummary } from "@stash/shared";
import { tzOffset } from "#lib/stats-data";
import type { AuditPage } from "#lib/audit";
import type {
  AnalysisSettings,
  AnalysisStats,
  SearchHit,
  Account,
  AttachmentKind,
  AttachmentStatus,
  ChatSummary,
  ChatType,
  EventOutcome,
  EventPage,
  EventStats,
  EventTypeCount,
  ExportSummary,
  MediaStats,
  MediaTaskDetail,
  MediaTaskPage,
  MessagePage,
  Platform,
  WebhookEventDetail,
} from "@stash/shared";
import { api } from "#lib/api";
import type { Locale } from "#lib/i18n";

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
  platforms: Platform[];
  accounts: string[];
  chatTypes: ChatType[];
  chatIds: string[];
  categories: string[];
  tags: string[];
  /** all, only messages with files, or only those with a failed download. */
  media: "all" | "media" | "failed";
  period: Period;
}

/** A time window back from now; resolved when the request is made. */
export type Period = "all" | "today" | "7d" | "30d" | "year";

/** Start of a period in ms (local midnight), or undefined for "all". */
export function periodStart(period: Period, now = new Date()): number | undefined {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (period) {
    case "today":
      return day;
    case "7d":
      return day - 6 * 86_400_000;
    case "30d":
      return day - 29 * 86_400_000;
    case "year":
      return new Date(now.getFullYear(), 0, 1).getTime();
    default:
      return undefined;
  }
}

export const messagesQuery = (filters: MessageFilters) =>
  infiniteQueryOptions({
    queryKey: ["messages", filters],
    queryFn: ({ pageParam }) =>
      api<MessagePage>(
        listUrl("/api/messages", {
          platform: filters.platforms,
          since: periodStart(filters.period),
          account: filters.accounts,
          chat: filters.chatTypes,
          chatid: filters.chatIds,
          category: filters.categories,
          tag: filters.tags,
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

export const chatsQuery = queryOptions({
  queryKey: ["messages", "chats"],
  queryFn: () => api<ChatSummary[]>("/api/messages/chats"),
});

export const apiTokenQuery = queryOptions({
  queryKey: ["settings", "api-token"],
  queryFn: () => api<{ masked: string | null }>("/api/settings/api-token"),
});

export type RetentionTarget = "events" | "tasks" | "trash" | "audit";

export interface RetentionStats {
  count: number;
  bytes: number;
  oldest: number | null;
}

export interface RetentionSettings {
  maxDays: number;
  targets: Record<RetentionTarget, { days: number; stats: RetentionStats }>;
}

export const retentionQuery = queryOptions({
  queryKey: ["settings", "retention"],
  queryFn: () => api<RetentionSettings>("/api/settings/retention"),
});

/** What an export with these options would contain (files, size, unsaved). */
export const exportSummaryQuery = (o: {
  platforms: string[];
  accounts: string[];
  chatTypes: string[];
  chatIds: string[];
  since?: number;
  until?: number;
  kinds: string[];
}) =>
  queryOptions({
    queryKey: ["export", "summary", o],
    queryFn: () =>
      api<ExportSummary>(
        listUrl("/api/export/summary", {
          platform: o.platforms,
          account: o.accounts,
          chat: o.chatTypes,
          chatid: o.chatIds,
          since: o.since,
          until: o.until,
          kind: o.kinds,
        }),
      ),
  });

export const localePrefsQuery = queryOptions({
  queryKey: ["locale-prefs"],
  queryFn: () => api<{ locale?: string | null; aiLanguage: Locale | "auto" }>("/api/settings/locale"),
});

export const analysisSettingsQuery = queryOptions({
  queryKey: ["analysis", "settings"],
  queryFn: () => api<AnalysisSettings>("/api/analysis/settings"),
});

export const analysisStatsQuery = queryOptions({
  queryKey: ["analysis", "stats"],
  queryFn: () => api<AnalysisStats & { configured: boolean; embeddingModel: string | null }>("/api/analysis/stats"),
});

/** Categories in use on messages, with counts. */
export const tagsQuery = queryOptions({
  queryKey: ["messages", "tags"],
  queryFn: () => api<{ tag: string; count: number }[]>("/api/messages/tags"),
});

export const categoriesQuery = queryOptions({
  queryKey: ["messages", "categories"],
  queryFn: () => api<{ category: string; count: number }[]>("/api/messages/categories"),
});

export const searchQuery = (q: string, filters: MessageFilters) =>
  queryOptions({
    queryKey: ["messages", "search", q, filters],
    queryFn: () =>
      api<{ hits: SearchHit[]; semantic: boolean }>(
        listUrl("/api/messages/search", {
          q,
          platform: filters.platforms,
          since: periodStart(filters.period),
          account: filters.accounts,
          chat: filters.chatTypes,
          chatid: filters.chatIds,
          category: filters.categories,
          tag: filters.tags,
          media: filters.media === "media" ? true : undefined,
          status: filters.media === "failed" ? "failed" : undefined,
        }),
      ),
    staleTime: 30_000,
  });

/** The recycle bin, most recently received first. */
export const trashQuery = infiniteQueryOptions({
  queryKey: ["messages", "trash"],
  queryFn: ({ pageParam }) => api<MessagePage>(listUrl("/api/messages", { trash: true, before: pageParam, limit: 30 })),
  initialPageParam: null as number | null,
  getNextPageParam: (last) => last.nextCursor,
});

export interface AuditFilters {
  q: string;
  category: string;
  action: string;
  actor: string;
  result: string;
}

const unlessAll = (v: string) => (v === "all" ? undefined : v);

/** The audit trail, newest first. */
export const auditQuery = (filters: AuditFilters) =>
  infiniteQueryOptions({
    queryKey: ["audit", filters],
    queryFn: ({ pageParam }) =>
      api<AuditPage>(
        listUrl("/api/audit", {
          q: filters.q || undefined,
          category: unlessAll(filters.category),
          action: unlessAll(filters.action),
          actor: unlessAll(filters.actor),
          result: unlessAll(filters.result),
          before: pageParam,
          limit: 50,
        }),
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

/** Actions and actors in the audit trail, with counts, for the filters. */
export const auditFacetsQuery = queryOptions({
  queryKey: ["audit", "facets"],
  queryFn: () => api<{ actions: { value: string; count: number }[]; actors: { value: string; count: number }[] }>("/api/audit/facets"),
});

/** The Stats page, in the viewer's time zone. */
export const statsQuery = queryOptions({
  queryKey: ["stats"],
  queryFn: () => api<StatsSummary>(`/api/stats?tz=${tzOffset()}`),
});

/** Backups of the messages in R2, newest first. */
export const backupsQuery = queryOptions({
  queryKey: ["backups"],
  queryFn: () => api<{ backups: BackupInfo[] }>("/api/backups"),
});

/** Scheduled tasks with their latest runs. */
export const cronQuery = queryOptions({
  queryKey: ["cron"],
  queryFn: () => api<CronOverview>("/api/cron"),
});
