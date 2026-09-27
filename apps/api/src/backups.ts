import type { Env } from "#types";

// JSON backups of the database side of Stash in R2 (backups/stash-*.json), as
// in PickIt: a daily one from the cron, "back up now", and a snapshot before
// each restore. They hold the live messages (with their AI labels) and their
// attachment rows; the files themselves are already in R2 and are not copied.
// Raw platform payloads and vectors are left out to keep backups small (and
// cheap to write within the free plan's CPU limit); vectors can be rebuilt.

const PREFIX = "backups/";
const RETENTION_MS = 30 * 86_400_000;
const NAME_RE = /^stash-[\w-]+\.json$/;
const VERSION = 1;

export type BackupKind = "daily" | "manual" | "pre-restore";

export interface BackupInfo {
  name: string;
  size: number;
  uploaded: number;
  /** Messages in the backup. */
  count: number | null;
  kind: BackupKind;
}

const MESSAGE_COLUMNS = [
  "account_id", "platform", "external_id", "event_type", "chat_type", "chat_id", "sender_id", "sender_name",
  "text", "sent_at", "received_at", "category", "tags", "summary", "ocr_text", "fields", "ai_status", "ai_error", "ai_at",
] as const;
const ATTACHMENT_COLUMNS = [
  "idx", "kind", "source_url", "filename", "content_type", "size", "width", "height", "status", "r2_key",
  "stored_size", "attempts", "last_error", "stored_at", "created_at", "updated_at", "thumb_status", "thumb_error",
] as const;

type Row = Record<string, unknown>;
interface BackupMessage extends Row {
  attachments: Row[];
}
interface BackupFile {
  version: number;
  createdAt: number;
  messages: BackupMessage[];
}

export class BackupError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
  }
}

export const isValidBackupName = (name: string) => NAME_RE.test(name);

function kindOf(name: string, meta?: Record<string, string>): BackupKind {
  const kind = meta?.kind;
  if (kind === "manual" || kind === "pre-restore" || kind === "daily") return kind;
  return name.includes("pre-restore") ? "pre-restore" : name.includes("manual") ? "manual" : "daily";
}

function backupName(kind: BackupKind, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  if (kind === "daily") return `stash-${date}.json`;
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `stash-${date}-${time}-${kind}.json`;
}

async function liveMessages(db: D1Database): Promise<BackupMessage[]> {
  const { results: messages } = await db
    .prepare(`SELECT id, ${MESSAGE_COLUMNS.join(", ")} FROM messages WHERE deleted_at IS NULL ORDER BY id`)
    .all<Row>();
  const { results: attachments } = await db
    .prepare(
      `SELECT a.message_id, ${ATTACHMENT_COLUMNS.map((c) => `a.${c}`).join(", ")}
       FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.deleted_at IS NULL ORDER BY a.message_id, a.idx`,
    )
    .all<Row>();
  const byMessage = new Map<unknown, Row[]>();
  for (const { message_id, ...a } of attachments) {
    const list = byMessage.get(message_id) ?? [];
    list.push(a);
    byMessage.set(message_id, list);
  }
  return messages.map(({ id, ...m }) => ({ ...m, attachments: byMessage.get(id) ?? [] }));
}

/** Writes the live messages to R2; the daily backup overwrites the same day's file. */
export async function writeBackup(env: Env, kind: BackupKind): Promise<BackupInfo> {
  const messages = await liveMessages(env.DB);
  const name = backupName(kind);
  const body = JSON.stringify({ version: VERSION, createdAt: Date.now(), messages } satisfies BackupFile);
  const obj = await env.MEDIA.put(PREFIX + name, body, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { count: String(messages.length), kind },
  });
  return { name, size: obj?.size ?? body.length, uploaded: Date.now(), count: messages.length, kind };
}

/** Today's daily backup, if it isn't there yet (the cron runs every 10 minutes). */
export async function dailyBackup(env: Env) {
  if (await env.MEDIA.head(PREFIX + backupName("daily"))) return;
  await writeBackup(env, "daily");
  await pruneBackups(env);
}

export async function listBackups(env: Env): Promise<BackupInfo[]> {
  const out: BackupInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({ prefix: PREFIX, cursor, include: ["customMetadata"] });
    for (const obj of page.objects) {
      const name = obj.key.slice(PREFIX.length);
      if (!isValidBackupName(name)) continue;
      const count = Number(obj.customMetadata?.count);
      out.push({
        name,
        size: obj.size,
        uploaded: obj.uploaded.getTime(),
        count: Number.isFinite(count) ? count : null,
        kind: kindOf(name, obj.customMetadata),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.uploaded - a.uploaded);
}

/** Deletes backups older than 30 days; returns how many. */
export async function pruneBackups(env: Env): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  const old = (await listBackups(env)).filter((b) => b.uploaded < cutoff);
  if (old.length) await env.MEDIA.delete(old.map((b) => PREFIX + b.name));
  return old.length;
}

export async function getBackupObject(env: Env, name: string): Promise<R2ObjectBody> {
  if (!isValidBackupName(name)) throw new BackupError("bad backup name", 400);
  const obj = await env.MEDIA.get(PREFIX + name);
  if (!obj) throw new BackupError("backup not found", 404);
  return obj;
}

export async function deleteBackup(env: Env, name: string) {
  await getBackupObject(env, name);
  await env.MEDIA.delete(PREFIX + name);
}

async function readBackup(env: Env, name: string): Promise<BackupMessage[]> {
  const obj = await getBackupObject(env, name);
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(await obj.text());
  } catch {
    throw new BackupError("backup file is corrupt", 400);
  }
  if (!Array.isArray(data.messages)) throw new BackupError("not a Stash backup", 400);
  return data.messages.filter(
    (m): m is BackupMessage => !!m && typeof m.account_id === "string" && typeof m.external_id === "string",
  );
}

export type RestoreMode = "merge" | "replace";

export interface RestoreResult {
  mode: RestoreMode;
  total: number;
  /** Messages added back (or that would be, for a dry run). */
  inserted: number;
  /** Already there (merge), so left as they are. */
  skipped: number;
  /** Their bot no longer exists, so they can't be restored. */
  noBot: number;
  /** Live messages moved to the trash first (replace mode). */
  trashed: number;
  /** Snapshot of the data before the restore; null for a dry run. */
  snapshot: string | null;
}

const val = (row: Row, col: string) => (row[col] === undefined ? null : row[col]);

/**
 * Restores a backup. "merge" adds messages that aren't here (by bot and
 * platform message id); "replace" moves every live message to the trash
 * first (recoverable), then brings back the backup's messages, including
 * ones that were in the trash. A snapshot is written before any change.
 */
export async function restoreBackup(env: Env, name: string, mode: RestoreMode, dryRun = false): Promise<RestoreResult> {
  const rows = await readBackup(env, name);
  const db = env.DB;
  const { results: bots } = await db.prepare("SELECT id FROM bot_accounts").all<{ id: string }>();
  const botIds = new Set(bots.map((b) => b.id));
  const { results: present } = await db
    .prepare("SELECT account_id, external_id, deleted_at FROM messages")
    .all<{ account_id: string; external_id: string; deleted_at: number | null }>();
  const existing = new Map(present.map((p) => [`${p.account_id}\n${p.external_id}`, p.deleted_at]));
  const live = present.filter((p) => p.deleted_at === null).length;

  const statements: D1PreparedStatement[] = [];
  let inserted = 0;
  let skipped = 0;
  let noBot = 0;
  for (const row of rows) {
    if (!botIds.has(row.account_id as string)) {
      noBot++;
      continue;
    }
    const key = `${row.account_id}\n${row.external_id}`;
    if (existing.has(key)) {
      if (mode === "merge") {
        skipped++;
        continue;
      }
      // Replace: bring it back (from the trash, where step one put it) with the backup's labels.
      statements.push(
        db
          .prepare(
            `UPDATE messages SET deleted_at = NULL, category = ?, tags = ?, summary = ?, ocr_text = ?, fields = ?
             WHERE account_id = ? AND external_id = ?`,
          )
          .bind(val(row, "category") ?? "", val(row, "tags") ?? "[]", val(row, "summary") ?? "", val(row, "ocr_text") ?? "", val(row, "fields") ?? "{}", row.account_id, row.external_id),
      );
      inserted++;
      continue;
    }
    existing.set(key, null);
    statements.push(
      db
        .prepare(`INSERT INTO messages (${MESSAGE_COLUMNS.join(", ")}) VALUES (${MESSAGE_COLUMNS.map(() => "?").join(", ")})`)
        .bind(...MESSAGE_COLUMNS.map((c) => val(row, c) ?? defaultFor(c))),
    );
    for (const a of Array.isArray(row.attachments) ? row.attachments : []) {
      statements.push(
        db
          .prepare(
            `INSERT INTO attachments (message_id, ${ATTACHMENT_COLUMNS.join(", ")})
             VALUES ((SELECT id FROM messages WHERE account_id = ? AND external_id = ?), ${ATTACHMENT_COLUMNS.map(() => "?").join(", ")})`,
          )
          .bind(row.account_id, row.external_id, ...ATTACHMENT_COLUMNS.map((c) => val(a, c) ?? defaultFor(c))),
      );
    }
    inserted++;
  }

  const result: RestoreResult = { mode, total: rows.length, inserted, skipped, noBot, trashed: mode === "replace" ? live : 0, snapshot: null };
  if (dryRun) return result;

  result.snapshot = (await writeBackup(env, "pre-restore")).name;
  if (mode === "replace") await db.prepare("UPDATE messages SET deleted_at = ? WHERE deleted_at IS NULL").bind(Date.now()).run();
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
  return result;
}

/** NOT NULL columns missing from an older or hand-edited backup. */
function defaultFor(col: string): unknown {
  if (col === "tags") return "[]";
  if (col === "fields") return "{}";
  if (["sent_at", "received_at", "created_at", "updated_at", "attempts", "idx"].includes(col)) return col === "attempts" || col === "idx" ? 0 : Date.now();
  if (["size", "width", "height", "r2_key", "stored_size", "stored_at", "ai_at"].includes(col)) return null;
  return "";
}
