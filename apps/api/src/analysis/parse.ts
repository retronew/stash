import { emptyFields, FIELD_KEYS, type MessageFields } from "@stash/shared";

export interface AnalysisResult {
  category: string;
  tags: string[];
  summary: string;
  ocrText: string;
  fields: MessageFields;
}

const MAX_TAGS = 5;
const MAX_OCR = 8000;
const MAX_ITEMS = 20;

/** Thrown when the reply has no JSON object in it. */
export class NoJsonError extends Error {}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function list(v: unknown, max: number, itemMax = 200): string[] {
  if (!Array.isArray(v)) return [];
  const items = v.filter((x): x is string | number => typeof x === "string" || typeof x === "number").map((x) => String(x).trim().slice(0, itemMax));
  return [...new Set(items.filter(Boolean))].slice(0, max);
}

/**
 * Reads the model's reply: the first {…} in it (models sometimes wrap JSON in
 * prose or a code fence). A category that matches an existing one apart from
 * case or spacing is written the existing way.
 */
export function parseAnalysis(text: string, categories: string[]): AnalysisResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new NoJsonError(`no JSON in the reply: ${text.slice(0, 120)}`);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch (err) {
    throw new NoJsonError(`invalid JSON in the reply: ${err instanceof Error ? err.message : String(err)}`);
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  let category = str(raw.category, 30);
  const existing = categories.find((c) => norm(c) === norm(category));
  if (existing) category = existing;

  const rawFields = (raw.fields && typeof raw.fields === "object" ? raw.fields : {}) as Record<string, unknown>;
  const fields = emptyFields();
  for (const key of FIELD_KEYS) fields[key] = list(rawFields[key], MAX_ITEMS);

  return {
    category,
    tags: list(raw.tags, MAX_TAGS, 30),
    summary: str(raw.summary, 300),
    ocrText: str(raw.ocr_text ?? raw.ocrText, MAX_OCR),
    fields,
  };
}

/** The text a message's vector is made from: what someone would search for. */
export function embeddingInput(parts: { text: string; summary: string; ocrText: string; category: string; tags: string[] }): string {
  return [parts.category, parts.tags.join(" "), parts.summary, parts.text, parts.ocrText.slice(0, 2000)].filter(Boolean).join("\n");
}
