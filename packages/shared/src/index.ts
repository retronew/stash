// Types shared by the web app and the API.

export * from "./cron";
export * from "./image-search";
export * from "./ai/index";

/** Chat platforms Stash can receive from. */
export const PLATFORMS = ["qq"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

export const CHAT_TYPES = ["c2c", "group", "channel", "dm"] as const;

/** c2c: one-to-one with the bot; group / channel: a message in a group or channel; dm: channel direct message. */
export type ChatType = (typeof CHAT_TYPES)[number];

export const ATTACHMENT_KINDS = ["image", "video", "audio", "file"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/**
 * pending: waiting in the queue (or for a retry); downloading: a consumer has it;
 * stored: in R2; failed: gave up after the last retry (can be retried by hand).
 */
export const ATTACHMENT_STATUSES = ["pending", "downloading", "stored", "failed"] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

/** A bot account on a platform, as the settings page sees it (the secret is masked). */
export interface Account {
  id: string;
  platform: Platform;
  name: string;
  appId: string;
  /** "abcd****wxyz", or "" when no secret is saved. */
  appSecretMasked: string;
  /** Path segment of the webhook URL: /api/webhooks/<platform>/<webhookKey>. */
  webhookKey: string;
  enabled: boolean;
  /** Last event received, ms. */
  lastEventAt: number | null;
  /** The bot's own picture, or null to show the platform icon. */
  avatarUrl: string | null;
  messageCount: number;
  createdAt: number;
}

export interface Attachment {
  id: number;
  kind: AttachmentKind;
  filename: string;
  contentType: string;
  /** Size the platform announced, bytes. */
  size: number | null;
  width: number | null;
  height: number | null;
  status: AttachmentStatus;
  /** Size actually stored in R2, bytes. */
  storedSize: number | null;
  attempts: number;
  lastError: string;
  storedAt: number | null;
}

/**
 * AI analysis of a message: "" never analyzed, pending (queued), running,
 * done, failed (gave up; can be retried), skipped (nothing to analyze).
 */
export const ANALYSIS_STATUSES = ["", "pending", "running", "done", "failed", "skipped"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

/** Key facts pulled out of the text and images. Every list may be empty. */
export interface MessageFields {
  amounts: string[];
  dates: string[];
  phones: string[];
  emails: string[];
  urls: string[];
  addresses: string[];
  /** Order, tracking, invoice, flight… numbers. */
  codes: string[];
  people: string[];
}

export const FIELD_KEYS = ["amounts", "dates", "phones", "emails", "urls", "addresses", "codes", "people"] as const satisfies readonly (keyof MessageFields)[];

export function emptyFields(): MessageFields {
  return { amounts: [], dates: [], phones: [], emails: [], urls: [], addresses: [], codes: [], people: [] };
}

export interface Message {
  id: number;
  accountId: string;
  platform: Platform;
  chatType: ChatType;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
  receivedAt: number;
  attachments: Attachment[];
  /** Set by AI analysis, or by hand. */
  category: string;
  tags: string[];
  /** One sentence about the message and its images. */
  summary: string;
  /** Text read from the images. */
  ocrText: string;
  fields: MessageFields;
  aiStatus: AnalysisStatus;
  aiError: string;
  /** When it was moved to the recycle bin (null: not deleted). */
  deletedAt: number | null;
}

/** A search result: a message and how well it matched (higher is better). */
export interface SearchHit extends Message {
  score: number;
}

/** How far AI analysis has got, for the settings page. */
export interface AnalysisStats {
  total: number;
  done: number;
  pending: number;
  failed: number;
  notAnalyzed: number;
  /** Analyses run today (UTC) and the daily cap. */
  today: number;
  dailyLimit: number;
  /** Messages with a vector from the current embedding model, and how many have anything to embed. */
  embedded: number;
  embeddable: number;
}

/** What analysis does and how much it may spend. */
export interface AnalysisSettings {
  /** Analyze new messages once their files are saved. */
  auto: boolean;
  /** At most this many analyses a day (UTC); 0 = no limit. */
  dailyLimit: number;
  /** Categories the model picks from (it may add one when none fits). */
  categories: string[];
  /** Images sent per message, and the largest image sent. */
  maxImages: number;
}

export const DEFAULT_CATEGORIES = ["工作", "生活", "学习", "购物", "票据", "出行", "截图", "其他"];

export interface MessagePage {
  messages: Message[];
  /** Pass as ?before= for the next page; null at the end. */
  nextCursor: number | null;
}

export interface MediaStats {
  pending: number;
  downloading: number;
  stored: number;
  failed: number;
  storedBytes: number;
}

/**
 * What became of one webhook call. stored / duplicate are hits (the event
 * was a message); the rest are misses.
 */
export const EVENT_OUTCOMES = ["stored", "duplicate", "ignored", "validation", "rejected", "error"] as const;
export type EventOutcome = (typeof EVENT_OUTCOMES)[number];

export const HIT_OUTCOMES: readonly EventOutcome[] = ["stored", "duplicate"];

export interface WebhookEvent {
  id: number;
  /** null when the webhook path matched no bot. */
  accountId: string | null;
  platform: Platform;
  eventType: string;
  outcome: EventOutcome;
  detail: string;
  messageId: number | null;
  receivedAt: number;
}

export interface WebhookEventDetail extends WebhookEvent {
  /** The request body (cut to 16 KB). */
  raw: string;
}

/** How often an event type appears in the log, for the event-type filter. */
export interface EventTypeCount {
  platform: Platform;
  type: string;
  count: number;
}

export interface EventPage {
  events: WebhookEvent[];
  nextCursor: number | null;
}

/** Counts per outcome over the last `sinceHours`. */
export interface EventStats {
  sinceHours: number;
  total: number;
  byOutcome: Record<EventOutcome, number>;
}

/** An attachment download with the message it belongs to, for the task queue. */
export interface MediaTask extends Attachment {
  messageId: number;
  accountId: string;
  platform: Platform;
  senderName: string;
  /** The message text, cut short. */
  text: string;
  createdAt: number;
  updatedAt: number;
  /** When the next queued retry is due. */
  nextRetryAt: number | null;
}

export interface MediaTaskDetail extends MediaTask {
  sourceUrl: string;
  r2Key: string | null;
}

export interface MediaTaskPage {
  tasks: MediaTask[];
  nextCursor: number | null;
}

/** A conversation seen in the messages: one group, channel or direct chat with a bot. */
export interface ChatSummary {
  accountId: string;
  platform: Platform;
  chatType: ChatType;
  chatId: string;
  /** For a direct chat: the other person's name, when the platform gives one. */
  name: string;
  messages: number;
  lastAt: number;
}

/** What an export with the current filters would contain. */
export interface ExportSummary {
  /** Messages matching the filters (all go into messages.json). */
  messages: number;
  /** Saved files of the chosen kinds, and their total size. */
  files: number;
  bytes: number;
  /** Matching files that aren't saved (yet): listed in the report instead. */
  unsaved: number;
}

/** The 1280px preview of a stored image, for lists (falls back to the original). */
export function thumbnailUrl(id: number): string {
  return `/api/media/${id}/preview`;
}

/** Attachment URL for <img src>, served from R2 by the API. */
export function attachmentUrl(id: number, download = false): string {
  return `/api/media/${id}${download ? "?download=1" : ""}`;
}

/** The Stats page: totals and breakdowns of live messages. */
export interface StatsSummary {
  messages: number;
  trash: number;
  analyzed: number;
  embedded: number;
  /** Saved files, their size, and files that failed to download. */
  files: number;
  bytes: number;
  failedFiles: number;
  /** Last 30 days, in the viewer's time zone (days without messages are missing). */
  byDay: { day: string; count: number }[];
  /** Last 12 months with messages, oldest first. */
  byMonth: { month: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byBot: { accountId: string; name: string; platform: Platform; count: number }[];
  byChatType: { chatType: ChatType; count: number }[];
  byKind: { kind: AttachmentKind; count: number; bytes: number }[];
  topChats: { accountId: string; chatType: ChatType; chatId: string; name: string; count: number }[];
}
