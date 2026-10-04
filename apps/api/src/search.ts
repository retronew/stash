import type { SearchHit } from "@stash/shared";
import type { Env } from "#types";
import { messageWhere, messagesByIds, type MessageQuery } from "#messages";
import { getAiSettings } from "#settings";
import { createProvider, embedText } from "#ai";
import { nearest } from "#vectors";

// Hybrid search, as in PickIt: keywords (FTS5 trigram index over the text,
// sender, summary, image text, tags and category; LIKE for queries under 3
// characters) fused with semantic search when an embedding model is set up.
// The usual message filters narrow both.

const KEYWORD_LIMIT = 50;
const SEMANTIC_LIMIT = 30;
/** Semantic matches below this similarity are noise. */
const MIN_SIMILARITY = 0.3;
const TRIGRAM = 3;

/** An FTS5 query matching every word as a phrase (quotes escaped). */
export function ftsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter((t) => [...t].length >= TRIGRAM)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" AND ");
}

async function keywordIds(env: Env, q: string, filter: MessageQuery): Promise<number[]> {
  const params: unknown[] = [];
  const where = messageWhere(filter, params);
  const match = ftsQuery(q);
  if (match) {
    const { results } = await env.DB.prepare(
      `SELECT m.id FROM messages_fts f JOIN messages m ON m.id = f.rowid
       WHERE messages_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
       ORDER BY bm25(messages_fts) LIMIT ${KEYWORD_LIMIT}`,
    )
      .bind(match, ...params)
      .all<{ id: number }>();
    return results.map((r) => r.id);
  }
  // Too short for trigrams (e.g. a two-character Chinese word).
  const like = `%${q.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
  const cols = ["m.text", "m.sender_name", "m.summary", "m.ocr_text", "m.tags", "m.category"];
  const { results } = await env.DB.prepare(
    `SELECT m.id FROM messages m WHERE (${cols.map((c) => `${c} LIKE ? ESCAPE '!'`).join(" OR ")})
     ${where.length ? `AND ${where.join(" AND ")}` : ""} ORDER BY m.id DESC LIMIT ${KEYWORD_LIMIT}`,
  )
    .bind(...cols.map(() => like), ...params)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

/** Semantic matches, or null when there's no embedding model to ask. */
async function semanticScores(env: Env, q: string, filter: MessageQuery): Promise<Map<number, number> | null> {
  const settings = await getAiSettings(env.DB);
  const provider = settings ? createProvider(settings, { db: env.DB, feature: "search" }) : null;
  if (!provider?.embedding) return null;
  const vector = await embedText(provider, q);
  if (!vector) return null;
  const top = await nearest(env.DB, vector, provider.embeddingModelId!, { limit: SEMANTIC_LIMIT, minScore: MIN_SIMILARITY });
  if (top.length === 0) return new Map();
  // Apply the filters to the semantic matches too.
  const params: unknown[] = [];
  const where = messageWhere(filter, params);
  const { results } = await env.DB.prepare(
    `SELECT m.id FROM messages m WHERE m.id IN (${top.map(() => "?").join(",")}) ${where.length ? `AND ${where.join(" AND ")}` : ""}`,
  )
    .bind(...top.map((t) => t.id), ...params)
    .all<{ id: number }>();
  const allowed = new Set(results.map((r) => r.id));
  return new Map(top.filter((t) => allowed.has(t.id)).map((t) => [t.id, t.score]));
}

/**
 * Best matches first. Keyword hits score by rank (1 down to 0.5); semantic
 * similarity adds on top, so a message found both ways ranks highest.
 * `semantic` says whether semantic search ran (an embedding model is set up
 * and answered), even when it found nothing.
 */
export async function searchMessages(
  env: Env,
  query: string,
  filter: MessageQuery = {},
  limit = 30,
): Promise<{ hits: SearchHit[]; semantic: boolean }> {
  const q = query.trim();
  if (!q) return { hits: [], semantic: false };
  const [keyword, semantic] = await Promise.all([
    keywordIds(env, q, filter),
    semanticScores(env, q, filter).catch((err) => {
      console.warn("semantic search unavailable", err);
      return null;
    }),
  ]);
  const scores = new Map<number, number>();
  keyword.forEach((id, i) => scores.set(id, 1 - (0.5 * i) / Math.max(keyword.length, 1)));
  for (const [id, s] of semantic ?? []) scores.set(id, (scores.get(id) ?? 0) + s);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const messages = await messagesByIds(env.DB, ranked.map(([id]) => id));
  const scoreOf = new Map(ranked);
  return { hits: messages.map((m) => ({ ...m, score: scoreOf.get(m.id) ?? 0 })), semantic: semantic !== null };
}
