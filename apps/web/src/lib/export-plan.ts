import { PLATFORMS, type Attachment, type AttachmentKind, type ChatType, type Message, type Platform } from "@stash/shared";
import { periodStart, type MessageFilters } from "#lib/queries";

// Pure parts of an export: which files, where they go in the ZIP, how they
// split into volumes, and the report. useExport does the fetching and writing.

export type ExportLayout = "bot" | "chat" | "flat";

export interface ExportOptions {
  platforms: Platform[];
  accounts: string[];
  chatTypes: ChatType[];
  /** Local dates (YYYY-MM-DD), inclusive; "" = open. */
  from: string;
  to: string;
  kinds: AttachmentKind[];
  layout: ExportLayout;
  /** Add messages.json with every matching message's text and details. */
  includeMessages: boolean;
}

export interface ExportFile {
  attachment: Attachment;
  message: Message;
  /** Path inside the ZIP. */
  path: string;
}

/** Volumes stay under this in browsers that can't stream to disk (a larger single file gets its own). */
export const VOLUME_LIMIT = 500 * 1024 * 1024;

/** A local date as YYYY-MM-DD. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Export options matching the message feed's filters. */
export function exportFromFilters(f: MessageFilters): Partial<ExportOptions> {
  const since = periodStart(f.period);
  return { platforms: f.platforms, accounts: f.accounts, chatTypes: f.chatTypes, from: since ? localDate(since) : "" };
}

/** since / until in ms for the API, from inclusive local dates. */
export function dateRange(from: string, to: string): { since?: number; until?: number } {
  const day = (d: string) => new Date(`${d}T00:00:00`).getTime();
  return {
    since: from ? day(from) : undefined,
    until: to ? day(to) + 86_400_000 : undefined,
  };
}

/** Characters Windows, macOS and Linux all accept in a path segment. */
export function safeName(name: string, fallback = "_"): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80);
  return cleaned || fallback;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
};

export function extensionOf(a: Pick<Attachment, "filename" | "contentType">): string {
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(a.filename)?.[1];
  return (fromName ?? EXTENSIONS[a.contentType.split(";")[0]] ?? "bin").toLowerCase();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09" and "0927-153012" in local time. */
function stamps(ms: number) {
  const d = new Date(ms);
  return {
    month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
    time: `${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
  };
}

/**
 * Where a file goes: <bot>/<month>/, <bot>/<chat>/ or flat, named
 * <MMDD-HHmmss>_<sender>_<attachment id>.<ext> so names sort by time and never collide.
 */
export function entryPath(a: Attachment, msg: Message, botName: string, layout: ExportLayout): string {
  const { month, time } = stamps(msg.sentAt);
  const file = `${time}_${safeName(msg.senderName || msg.senderId, "unknown")}_${a.id}.${extensionOf(a)}`;
  const bot = safeName(botName, "bot");
  if (layout === "flat") return file;
  if (layout === "chat") return `${bot}/${safeName(`${msg.chatType}-${msg.chatId}`, msg.chatType)}/${file}`;
  return `${bot}/${month}/${file}`;
}

/** The saved files among the messages (of the chosen kinds), and those not saved. */
export function planFiles(
  messages: Message[],
  kinds: AttachmentKind[],
  botName: (accountId: string) => string,
  layout: ExportLayout,
): { files: ExportFile[]; unsaved: ExportFile[] } {
  const files: ExportFile[] = [];
  const unsaved: ExportFile[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments) {
      if (kinds.length && !kinds.includes(attachment.kind)) continue;
      const entry = { attachment, message, path: entryPath(attachment, message, botName(message.accountId), layout) };
      (attachment.status === "stored" ? files : unsaved).push(entry);
    }
  }
  return { files, unsaved };
}

/** Consecutive groups of files, each under `limit` bytes unless one file alone is larger. */
export function splitVolumes<T>(files: T[], sizeOf: (f: T) => number, limit = VOLUME_LIMIT): T[][] {
  const volumes: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const f of files) {
    const s = sizeOf(f);
    if (current.length && size + s > limit) {
      volumes.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += s;
  }
  if (current.length) volumes.push(current);
  return volumes;
}

/** stash-qq-20260927.zip, or stash-qq-20260927-part2of3.zip. */
export function zipName(platforms: Platform[], part: number, parts: number, now = new Date()): string {
  // No platform chosen but only one exists: that's the one being exported.
  const chosen = platforms.length ? platforms : PLATFORMS.length === 1 ? PLATFORMS : [];
  const scope = chosen.length === 1 ? chosen[0] : "all";
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `stash-${scope}-${date}${parts > 1 ? `-part${part}of${parts}` : ""}.zip`;
}

/** messages.json: every matching message, with where its files ended up. */
export function messagesJson(messages: Message[], files: ExportFile[], botName: (id: string) => string): string {
  const pathOf = new Map(files.map((f) => [f.attachment.id, f.path]));
  return JSON.stringify(
    messages.map((msg) => ({
      id: msg.id,
      platform: msg.platform,
      bot: botName(msg.accountId),
      chatType: msg.chatType,
      chatId: msg.chatId,
      sender: msg.senderName || msg.senderId,
      text: msg.text,
      sentAt: new Date(msg.sentAt).toISOString(),
      attachments: msg.attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        filename: a.filename,
        status: a.status,
        path: pathOf.get(a.id) ?? null,
      })),
    })),
    null,
    2,
  );
}

export interface ExportFailure {
  file: ExportFile;
  error: string;
}

/** report.txt: what's in the archive and what isn't, and why. */
export function reportText(done: number, unsaved: ExportFile[], failed: ExportFailure[], when = new Date()): string {
  const lines = [`Stash export ${when.toISOString()}`, `Files in this archive: ${done}`, ""];
  if (unsaved.length) {
    lines.push(`Not saved in Stash yet (${unsaved.length}):`);
    for (const f of unsaved) lines.push(`  #${f.attachment.id} ${f.path} [${f.attachment.status}] ${f.attachment.lastError}`.trimEnd());
    lines.push("");
  }
  if (failed.length) {
    lines.push(`Failed to download during export (${failed.length}):`);
    for (const f of failed) lines.push(`  #${f.file.attachment.id} ${f.file.path}: ${f.error}`);
  }
  return lines.join("\n") + "\n";
}
