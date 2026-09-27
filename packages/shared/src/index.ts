// Types shared by the web app and the API.

/** Chat platforms Stash can receive from. */
export const PLATFORMS = ["qq"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** c2c: one-to-one with the bot; group / channel: a message in a group or channel; dm: channel direct message. */
export type ChatType = "c2c" | "group" | "channel" | "dm";

export type AttachmentKind = "image" | "video" | "audio" | "file";

/**
 * pending: waiting in the queue (or for a retry); downloading: a consumer has it;
 * stored: in R2; failed: gave up after the last retry (can be retried by hand).
 */
export type AttachmentStatus = "pending" | "downloading" | "stored" | "failed";

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
}

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
export type EventOutcome = "stored" | "duplicate" | "ignored" | "validation" | "rejected" | "error";

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

/** Attachment URL for <img src>, served from R2 by the API. */
export function attachmentUrl(id: number, download = false): string {
  return `/api/media/${id}${download ? "?download=1" : ""}`;
}
