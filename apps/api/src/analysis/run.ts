import type { Env } from "#types";
import { createProvider, embedText } from "#ai";
import { getAiSettings } from "#settings";
import { aiLocale } from "#locale";
import { vectorColumns } from "#vectors";
import { getAnalysisSettings } from "#analysis/settings";
import { analysisPrompt } from "#analysis/prompt";
import { embeddingInput, parseAnalysis, type AnalysisResult } from "#analysis/parse";
import { parseFields, parseTags } from "#messages";
import { thumbKey } from "#media/thumbs";

// One message's analysis: text and saved images to the chat model (JSON
// back), then the vector for semantic search. Either model may be missing:
// without chat, only the text is embedded; without embedding, no vector.

/** Originals larger than this aren't sent when there's no preview (base64 adds a third, and costs CPU and tokens). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface Row {
  id: number;
  chat_type: string;
  sender_name: string;
  sender_id: string;
  text: string;
  sent_at: number;
  category: string;
  tags: string;
  summary: string;
  ocr_text: string;
  fields: string;
}

interface FileRow {
  id: number;
  kind: string;
  filename: string;
  status: string;
  content_type: string;
  stored_size: number | null;
  r2_key: string | null;
}

/** AI isn't set up; the message goes back to "not analyzed". */
export class NotConfiguredError extends Error {}

/**
 * Some files are still downloading; the message goes back to "not analyzed"
 * and is analyzed once they settle (analyzeWhenReady), so its images count.
 */
export class FilesPendingError extends Error {}

export type RunOutcome = "done" | "skipped";

export async function analyzeMessage(env: Env, id: number): Promise<RunOutcome> {
  const aiSettings = await getAiSettings(env.DB);
  const provider = aiSettings ? createProvider(aiSettings, { db: env.DB, feature: "analyze" }) : null;
  if (!provider) throw new NotConfiguredError("AI isn't configured");

  const row = await env.DB.prepare(
    "SELECT id, chat_type, sender_name, sender_id, text, sent_at, category, tags, summary, ocr_text, fields FROM messages WHERE id = ?",
  )
    .bind(id)
    .first<Row>();
  if (!row) return "skipped";
  const { results: files } = await env.DB.prepare(
    "SELECT id, kind, filename, status, content_type, stored_size, r2_key FROM attachments WHERE message_id = ? ORDER BY idx",
  )
    .bind(id)
    .all<FileRow>();

  if (files.some((f) => f.status === "pending" || f.status === "downloading")) {
    throw new FilesPendingError("waiting for files to download");
  }

  let result: AnalysisResult = {
    category: row.category,
    tags: parseTags(row.tags),
    summary: row.summary,
    ocrText: row.ocr_text,
    fields: parseFields(row.fields),
  };

  if (provider.chat) {
    const settings = await getAnalysisSettings(env.DB);
    // The 1280px preview (the one lists show) when there is one (any size of original); else the
    // original, if it's a type the models take and small enough.
    const images = files
      .filter((f) => f.status === "stored" && f.r2_key && f.kind === "image")
      .slice(0, settings.maxImages);
    const parts = await Promise.all(
      images.map(async (f) => {
        const preview = await env.MEDIA.get(thumbKey(f.id));
        if (preview) return { type: "image" as const, image: new Uint8Array(await preview.arrayBuffer()), mediaType: "image/webp" };
        if (!IMAGE_TYPES.has(f.content_type) || (f.stored_size ?? 0) > MAX_IMAGE_BYTES) return null;
        const object = await env.MEDIA.get(f.r2_key!);
        return object ? { type: "image" as const, image: new Uint8Array(await object.arrayBuffer()), mediaType: f.content_type } : null;
      }),
    );
    const imageParts = parts.filter((p) => p !== null);
    if (!row.text.trim() && imageParts.length === 0) return "skipped";
    const { system, prompt } = analysisPrompt(await aiLocale(env.DB), {
      categories: settings.categories,
      chatType: row.chat_type,
      sender: row.sender_name || row.sender_id,
      sentAt: row.sent_at,
      text: row.text,
      files: files.map((f) => f.filename || f.kind),
      images: imageParts.length,
    });
    const { generateText } = await import("ai");
    const { text } = await generateText({
      model: provider.chat,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...imageParts] }],
      maxOutputTokens: 3000,
      maxRetries: 1,
    });
    result = parseAnalysis(text, settings.categories);
  } else if (!row.text.trim()) {
    return "skipped";
  }

  const vector = provider.embedding
    ? await embedText(provider, embeddingInput({ ...result, text: row.text }))
    : null;
  const cols = vector ? vectorColumns(vector) : null;

  await env.DB.prepare(
    `UPDATE messages SET category = ?, tags = ?, summary = ?, ocr_text = ?, fields = ?,
       embedding = COALESCE(?, embedding), vec = COALESCE(?, vec), embedding_model = COALESCE(?, embedding_model)
     WHERE id = ?`,
  )
    .bind(
      result.category,
      JSON.stringify(result.tags),
      result.summary,
      result.ocrText,
      JSON.stringify(result.fields),
      cols?.embedding ?? null,
      cols?.vec ?? null,
      cols ? provider.embeddingModelId! : null,
      id,
    )
    .run();
  return "done";
}
