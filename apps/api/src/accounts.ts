import type { Account, Platform } from "@stash/shared";

export interface BotAccountRow {
  id: string;
  platform: Platform;
  name: string;
  app_id: string;
  app_secret: string;
  webhook_key: string;
  enabled: number;
  last_event_at: number | null;
  avatar_key: string | null;
  avatar_updated_at: number | null;
  created_at: number;
  updated_at: number;
  /** Only from listAccounts. */
  message_count?: number;
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "****";
  return secret.slice(0, 4) + "****" + secret.slice(-4);
}

export function toAccount(row: BotAccountRow): Account {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    appId: row.app_id,
    appSecretMasked: maskSecret(row.app_secret),
    webhookKey: row.webhook_key,
    enabled: row.enabled === 1,
    lastEventAt: row.last_event_at,
    avatarUrl: row.avatar_key ? `/api/accounts/${row.id}/avatar?v=${row.avatar_updated_at ?? 0}` : null,
    messageCount: row.message_count ?? 0,
    createdAt: row.created_at,
  };
}

/** A hard-to-guess URL segment, so strangers can't even reach the signature check. */
export function newWebhookKey(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/** Letters, digits, - and _; 8 to 64 long. */
export function isValidWebhookKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(key);
}

export async function listAccounts(db: D1Database): Promise<BotAccountRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM messages m WHERE m.account_id = b.id) AS message_count
       FROM bot_accounts b ORDER BY b.created_at`,
    )
    .all<BotAccountRow>();
  return results;
}

export async function getAccount(db: D1Database, id: string): Promise<BotAccountRow | null> {
  return db.prepare("SELECT * FROM bot_accounts WHERE id = ?").bind(id).first<BotAccountRow>();
}

export async function findByWebhookKey(db: D1Database, platform: Platform, key: string) {
  return db
    .prepare("SELECT * FROM bot_accounts WHERE platform = ? AND webhook_key = ?")
    .bind(platform, key)
    .first<BotAccountRow>();
}

export interface AccountInput {
  name?: string;
  appId?: string;
  /** Empty or missing keeps the saved secret. */
  appSecret?: string;
  webhookKey?: string;
  enabled?: boolean;
}

export async function createAccount(db: D1Database, platform: Platform, input: AccountInput): Promise<BotAccountRow> {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO bot_accounts (id, platform, name, app_id, app_secret, webhook_key, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      platform,
      input.name?.trim() ?? "",
      input.appId?.trim() ?? "",
      input.appSecret?.trim() ?? "",
      input.webhookKey ?? newWebhookKey(),
      input.enabled === false ? 0 : 1,
      now,
      now,
    )
    .run();
  return (await getAccount(db, id))!;
}

export async function updateAccount(db: D1Database, row: BotAccountRow, input: AccountInput): Promise<BotAccountRow> {
  await db
    .prepare(
      `UPDATE bot_accounts SET name = ?, app_id = ?, app_secret = ?, webhook_key = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name?.trim() ?? row.name,
      input.appId?.trim() ?? row.app_id,
      input.appSecret?.trim() || row.app_secret,
      input.webhookKey ?? row.webhook_key,
      input.enabled === undefined ? row.enabled : input.enabled ? 1 : 0,
      Date.now(),
      row.id,
    )
    .run();
  return (await getAccount(db, row.id))!;
}

export async function touchAccount(db: D1Database, id: string) {
  await db.prepare("UPDATE bot_accounts SET last_event_at = ? WHERE id = ?").bind(Date.now(), id).run();
}

export async function setAvatarKey(db: D1Database, id: string, key: string | null) {
  await db
    .prepare("UPDATE bot_accounts SET avatar_key = ?, avatar_updated_at = ? WHERE id = ?")
    .bind(key, Date.now(), id)
    .run();
}
