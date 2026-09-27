import type { Env } from "#types";
import type { BotAccountRow } from "#accounts";
import type { IncomingMessage } from "#platforms/types";
import { enqueueDownloads } from "#media/jobs";
import { analyzeWhenReady } from "#analysis/queue";

export interface Ingested {
  messageId: number;
  /** false: a redelivery of a message already saved. */
  created: boolean;
}

/**
 * Saves messages and their attachment rows in one transaction per message,
 * then queues the downloads. A redelivered message changes nothing, but its
 * still-pending attachments are queued again (the consumer ignores repeats).
 * Throws if D1 fails, so the webhook answers 5xx and the platform retries.
 */
export async function ingestMessages(env: Env, account: BotAccountRow, messages: IncomingMessage[]): Promise<Ingested[]> {
  const now = Date.now();
  const out: Ingested[] = [];
  for (const msg of messages) {
    const messageId = `(SELECT id FROM messages WHERE account_id = ?1 AND external_id = ?2)`;
    const [inserted] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO messages (account_id, platform, external_id, event_type, chat_type, chat_id,
           sender_id, sender_name, text, raw, sent_at, received_at)
         VALUES (?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT (account_id, external_id) DO NOTHING`,
      ).bind(
        account.id, msg.externalId, account.platform, msg.eventType, msg.chatType, msg.chatId,
        msg.senderId, msg.senderName, msg.text, msg.raw, msg.sentAt, now,
      ),
      ...msg.attachments.map((a, idx) =>
        env.DB.prepare(
          `INSERT INTO attachments (message_id, idx, kind, source_url, filename, content_type, size, width, height,
             status, created_at, updated_at)
           VALUES (${messageId}, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending', ?11, ?11)
           ON CONFLICT (message_id, idx) DO NOTHING`,
        ).bind(account.id, msg.externalId, idx, a.kind, a.url, a.filename, a.contentType, a.size, a.width, a.height, now),
      ),
    ]);
    const row = await env.DB.prepare(`SELECT id FROM messages WHERE account_id = ? AND external_id = ?`)
      .bind(account.id, msg.externalId)
      .first<{ id: number }>();
    out.push({ messageId: row!.id, created: inserted.meta.changes > 0 });

    if (msg.attachments.length === 0) {
      // Text only: nothing to wait for.
      if (inserted.meta.changes > 0) await analyzeWhenReady(env, row!.id);
      continue;
    }
    const { results } = await env.DB.prepare(`SELECT id FROM attachments WHERE message_id = ? AND status = 'pending'`)
      .bind(row!.id)
      .all<{ id: number }>();
    await enqueueDownloads(env, results.map((r) => r.id));
  }
  return out;
}
