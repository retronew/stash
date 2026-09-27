import type { AttachmentKind, ChatType } from "@stash/shared";
import type { IncomingAttachment, IncomingMessage } from "#platforms/types";

// Message events from the QQ Bot API (v2) and how they map to Stash.
// https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/event.html

export interface QQPayload {
  id?: string;
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
}

interface QQAttachment {
  content_type?: string;
  filename?: string;
  url?: string;
  size?: number | string;
  width?: number | string;
  height?: number | string;
}

interface QQMessageData {
  id?: string;
  content?: string;
  timestamp?: string;
  attachments?: QQAttachment[];
  author?: { id?: string; user_openid?: string; member_openid?: string; username?: string };
  group_openid?: string;
  channel_id?: string;
  guild_id?: string;
}

const CHAT_TYPES: Record<string, ChatType> = {
  C2C_MESSAGE_CREATE: "c2c",
  GROUP_AT_MESSAGE_CREATE: "group",
  AT_MESSAGE_CREATE: "channel",
  MESSAGE_CREATE: "channel",
  DIRECT_MESSAGE_CREATE: "dm",
};

export function isMessageEvent(type: string | undefined): boolean {
  return !!type && type in CHAT_TYPES;
}

function num(value: number | string | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** QQ sometimes sends attachment URLs without a scheme ("gchat.qpic.cn/…"). */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function attachmentKind(contentType: string, filename: string): AttachmentKind {
  const type = contentType.toLowerCase();
  if (type.startsWith("image")) return "image";
  if (type.startsWith("video")) return "video";
  if (type.startsWith("audio") || type === "voice") return "audio";
  if (!type || type === "file") {
    if (/\.(jpe?g|png|gif|webp|bmp|heic|avif)$/i.test(filename)) return "image";
    if (/\.(mp4|mov|mkv|webm)$/i.test(filename)) return "video";
  }
  return "file";
}

function toAttachment(a: QQAttachment): IncomingAttachment | null {
  if (!a.url) return null;
  const contentType = a.content_type ?? "";
  const filename = a.filename ?? "";
  return {
    kind: attachmentKind(contentType, filename),
    url: normalizeUrl(a.url),
    filename,
    // "file" etc. aren't MIME types; the download fills in the real one.
    contentType: contentType.includes("/") ? contentType : "",
    size: num(a.size),
    width: num(a.width),
    height: num(a.height),
  };
}

/** The message in a dispatch payload, or null for events Stash doesn't store. */
export function parseMessageEvent(payload: QQPayload, raw: string): IncomingMessage | null {
  const chatType = payload.t ? CHAT_TYPES[payload.t] : undefined;
  const d = payload.d as QQMessageData | undefined;
  if (!chatType || !d?.id) return null;
  const author = d.author ?? {};
  const senderId = author.user_openid ?? author.member_openid ?? author.id ?? "";
  const chatId =
    chatType === "c2c" ? senderId
    : chatType === "group" ? (d.group_openid ?? "")
    : chatType === "dm" ? (d.guild_id ?? "")
    : (d.channel_id ?? "");
  const sentAt = d.timestamp ? Date.parse(d.timestamp) : NaN;
  return {
    externalId: d.id,
    eventType: payload.t!,
    chatType,
    chatId,
    senderId,
    senderName: author.username ?? "",
    text: (d.content ?? "").trim(),
    sentAt: Number.isFinite(sentAt) ? sentAt : Date.now(),
    raw,
    attachments: (d.attachments ?? []).map(toAttachment).filter((a): a is IncomingAttachment => a !== null),
  };
}
