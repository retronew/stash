import { CHAT_TYPES, attachmentUrl, type Attachment, type ChatType, type Message } from "@stash/shared";
import type { Env } from "#types";
import { getMessage, listMessages, mediaStats } from "#messages";
import { listAccounts } from "#accounts";
import { listTasks } from "#media/tasks";
import { resetForRetry } from "#media/attachments";
import { enqueueDownloads } from "#media/jobs";

// Tools exposed to AI assistants over MCP. Results are compact JSON a model
// can read; every call runs as the API token's owner.

export interface ToolContext {
  env: Env;
  /** This deployment's origin, for absolute file URLs. */
  origin: string;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

/** Thrown for bad arguments; reported to the model as a tool error. */
export class ToolError extends Error {}

/** A tool result that is a picture: sent as an MCP image block. */
export class ToolImage {
  constructor(
    readonly data: string,
    readonly mimeType: string,
    readonly meta: unknown,
  ) {}
}

/** Largest image view_attachment returns inline (base64 grows it by a third). */
const MAX_INLINE_IMAGE = 3 * 1024 * 1024;
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** An ISO date / datetime as ms, or undefined. */
function date(value: unknown, field: string): number | undefined {
  const s = str(value);
  if (!s) return undefined;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) throw new ToolError(`${field} must be an ISO date, e.g. 2026-09-27`);
  return ms;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function attachment(a: Attachment, origin: string) {
  return {
    id: a.id,
    kind: a.kind,
    filename: a.filename,
    contentType: a.contentType,
    status: a.status,
    size: a.storedSize ?? a.size,
    ...(a.width && a.height ? { width: a.width, height: a.height } : {}),
    ...(a.status === "stored" ? { url: origin + attachmentUrl(a.id) } : {}),
    ...(a.status === "failed" ? { error: a.lastError } : {}),
  };
}

function message(msg: Message, origin: string) {
  return {
    id: msg.id,
    platform: msg.platform,
    bot: msg.accountId,
    chatType: msg.chatType,
    chatId: msg.chatId,
    sender: msg.senderName || msg.senderId,
    text: msg.text,
    sentAt: new Date(msg.sentAt).toISOString(),
    attachments: msg.attachments.map((a) => attachment(a, origin)),
  };
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 0x8000) out += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(out);
}

export const TOOLS: Tool[] = [
  {
    name: "search_messages",
    title: "Search messages",
    description:
      "Find messages the user received through their chat bots, newest first. All filters are " +
      "optional: text (matches the message or the sender's name), bots, chat types, a date range, " +
      "and only messages with files. Stored files come with a URL (needs the same API token).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Words the message text or sender name contains" },
        bots: { type: "array", items: { type: "string" }, description: "Bot ids from list_bots" },
        chat_types: { type: "array", items: { type: "string", enum: [...CHAT_TYPES] } },
        since: { type: "string", description: "ISO date or datetime (inclusive)" },
        until: { type: "string", description: "ISO date or datetime (exclusive)" },
        with_files: { type: "boolean", description: "Only messages that have attachments" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        before_id: { type: "integer", description: "Paging: pass the previous result's next_before_id" },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { env, origin }) {
      const page = await listMessages(env.DB, {
        query: str(args.text) || undefined,
        accountIds: strings(args.bots),
        chatTypes: strings(args.chat_types).filter((t): t is ChatType => (CHAT_TYPES as readonly string[]).includes(t)),
        since: date(args.since, "since"),
        until: date(args.until, "until"),
        withMedia: args.with_files === true,
        before: typeof args.before_id === "number" ? args.before_id : undefined,
        limit: int(args.limit, 20, 1, 50),
      });
      return { messages: page.messages.map((msg) => message(msg, origin)), next_before_id: page.nextCursor };
    },
  },
  {
    name: "get_message",
    title: "Get a message",
    description: "One message by id, with its text and every attachment's type, size, status and URL.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
    async run(args, { env, origin }) {
      const msg = await getMessage(env.DB, int(args.id, 0, 0, Number.MAX_SAFE_INTEGER));
      if (!msg) throw new ToolError(`no message with id ${String(args.id)}`);
      return message(msg, origin);
    },
  },
  {
    name: "view_attachment",
    title: "View an image",
    description:
      "Look at a saved image attachment (by attachment id from search_messages / get_message). " +
      "Images up to 3 MB come back as pictures; other files return their details and URL.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer", description: "Attachment id" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
    async run(args, { env, origin }) {
      const id = int(args.id, 0, 0, Number.MAX_SAFE_INTEGER);
      const row = await env.DB.prepare(
        "SELECT r2_key, filename, kind, status, stored_size, content_type FROM attachments WHERE id = ?",
      )
        .bind(id)
        .first<{ r2_key: string | null; filename: string; kind: string; status: string; stored_size: number | null; content_type: string }>();
      if (!row) throw new ToolError(`no attachment with id ${id}`);
      const meta = { id, filename: row.filename, kind: row.kind, status: row.status, size: row.stored_size, url: origin + attachmentUrl(id) };
      if (row.status !== "stored" || !row.r2_key) throw new ToolError(`attachment ${id} is not saved yet (status: ${row.status})`);
      if (!INLINE_TYPES.has(row.content_type) || (row.stored_size ?? 0) > MAX_INLINE_IMAGE) return meta;
      const object = await env.MEDIA.get(row.r2_key);
      if (!object) throw new ToolError(`file for attachment ${id} is missing from storage`);
      return new ToolImage(base64(await object.arrayBuffer()), row.content_type, meta);
    },
  },
  {
    name: "list_bots",
    title: "List bots",
    description: "The user's bots (id, platform, name, message count, last event), for filtering searches.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { env }) {
      const rows = await listAccounts(env.DB);
      return {
        bots: rows.map((r) => ({
          id: r.id,
          platform: r.platform,
          name: r.name,
          enabled: r.enabled === 1,
          messages: r.message_count ?? 0,
          lastEventAt: r.last_event_at ? new Date(r.last_event_at).toISOString() : null,
        })),
      };
    },
  },
  {
    name: "get_download_status",
    title: "Download status",
    description:
      "How many files are saved, queued or failed, storage used, and the most recent failed downloads with their errors.",
    inputSchema: {
      type: "object",
      properties: { failed_limit: { type: "integer", minimum: 0, maximum: 50, default: 10 } },
    },
    annotations: { readOnlyHint: true },
    async run(args, { env }) {
      const failedLimit = int(args.failed_limit, 10, 0, 50);
      const [stats, failed] = await Promise.all([
        mediaStats(env.DB),
        failedLimit ? listTasks(env.DB, { statuses: ["failed"], limit: failedLimit }) : null,
      ]);
      return {
        ...stats,
        recentFailures: (failed?.tasks ?? []).map((t) => ({
          id: t.id,
          messageId: t.messageId,
          filename: t.filename,
          attempts: t.attempts,
          error: t.lastError,
        })),
      };
    },
  },
  {
    name: "retry_downloads",
    title: "Retry failed downloads",
    description: "Queue failed downloads again: the given attachment ids, or every failed one when ids is omitted.",
    inputSchema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "integer" } } },
    },
    annotations: { idempotentHint: true },
    async run(args, { env }) {
      const ids = Array.isArray(args.ids) ? args.ids.filter((id): id is number => Number.isInteger(id)) : null;
      const reset = await resetForRetry(env.DB, ids ?? "failed");
      await enqueueDownloads(env, reset);
      return { queued: reset };
    },
  },
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
