import type { Env } from "#types";
import { createProvider, describeError, embedText, embedTexts } from "#ai";
import { getAiSettings } from "#settings";
import { vectorColumns } from "#vectors";
import { embeddingInput } from "#analysis/parse";
import { parseTags } from "#messages";
import { enqueueJobs } from "#media/jobs";
import { nextDelaySeconds } from "#media/retry";

// Rebuilding the vector index (PickIt's "reembed"): only the embedding model
// runs, from what analysis already stored, in queue jobs of EMBED_BATCH messages.

export const EMBED_BATCH = 32;
export type ReembedMode = "missing" | "all";

/** Something to embed: text, or what analysis found. */
const EMBEDDABLE = "deleted_at IS NULL AND (text != '' OR summary != '' OR ocr_text != '')";

export async function currentEmbeddingModel(env: Env): Promise<string | null> {
  const settings = await getAiSettings(env.DB);
  return (settings && createProvider(settings)?.embeddingModelId) || null;
}

/** Messages embedded with the current model, and how many could be. */
export async function embedCounts(env: Env): Promise<{ embedded: number; embeddable: number; model: string | null }> {
  const model = await currentEmbeddingModel(env);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS embeddable, SUM(vec IS NOT NULL AND embedding_model = ?) AS embedded FROM messages WHERE ${EMBEDDABLE}`,
  )
    .bind(model ?? "")
    .first<{ embeddable: number; embedded: number | null }>();
  return { embedded: row?.embedded ?? 0, embeddable: row?.embeddable ?? 0, model };
}

/** Queues the rebuild; returns how many messages. Null without an embedding model. */
export async function queueReembed(env: Env, mode: ReembedMode): Promise<number | null> {
  const model = await currentEmbeddingModel(env);
  if (!model) return null;
  const missing = mode === "missing" ? " AND (vec IS NULL OR embedding_model IS NOT ?)" : "";
  const stmt = env.DB.prepare(`SELECT id FROM messages WHERE ${EMBEDDABLE}${missing} ORDER BY id DESC LIMIT 5000`);
  const { results } = await (missing ? stmt.bind(model) : stmt).all<{ id: number }>();
  const ids = results.map((r) => r.id);
  const jobs = [];
  for (let i = 0; i < ids.length; i += EMBED_BATCH) jobs.push({ kind: "embed" as const, ids: ids.slice(i, i + EMBED_BATCH) });
  await enqueueJobs(env, jobs);
  return ids.length;
}

interface Row {
  id: number;
  text: string;
  summary: string;
  ocr_text: string;
  category: string;
  tags: string;
}

/** One "embed" queue job. Retries with the download backoff; gives up quietly (missing mode picks them up again). */
export async function processEmbedJob(message: Message<unknown>, env: Env, ids: number[]) {
  try {
    const settings = await getAiSettings(env.DB);
    const provider = settings ? createProvider(settings) : null;
    if (!provider?.embedding || ids.length === 0) {
      message.ack();
      return;
    }
    const { results: rows } = await env.DB.prepare(
      `SELECT id, text, summary, ocr_text, category, tags FROM messages
       WHERE deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
    )
      .bind(...ids)
      .all<Row>();
    const inputs = rows.map((r) =>
      embeddingInput({ text: r.text, summary: r.summary, ocrText: r.ocr_text, category: r.category, tags: parseTags(r.tags) }),
    );
    let vectors: (number[] | null)[];
    try {
      vectors = (await embedTexts(provider, inputs)) ?? [];
    } catch {
      // Batch rejected: one by one, so one bad input doesn't sink the rest.
      vectors = await Promise.all(inputs.map((t) => embedText(provider, t).catch(() => null)));
    }
    const writes = rows.flatMap((r, i) => {
      const v = vectors[i];
      if (!v) return [];
      const cols = vectorColumns(v);
      return [
        env.DB.prepare("UPDATE messages SET embedding = ?, vec = ?, embedding_model = ? WHERE id = ?").bind(
          cols.embedding,
          cols.vec,
          provider.embeddingModelId!,
          r.id,
        ),
      ];
    });
    if (writes.length) await env.DB.batch(writes);
    if (writes.length < rows.length) throw new Error(`${rows.length - writes.length} of ${rows.length} failed`);
    message.ack();
  } catch (err) {
    const delay = nextDelaySeconds(message.attempts);
    console.warn("embedding failed", { ids: ids.length, attempts: message.attempts, error: describeError(err), retryIn: delay });
    if (delay === null) message.ack();
    else message.retry({ delaySeconds: delay });
  }
}
