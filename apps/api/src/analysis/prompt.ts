import { AI_LANGUAGE, type Locale } from "@stash/shared/i18n";

// The analysis prompt. Written in English (followed most reliably across
// providers) with an explicit output language, as in PickIt's prompts.ts.

export interface PromptInput {
  categories: string[];
  chatType: string;
  sender: string;
  sentAt: number;
  text: string;
  /** Names of the files, including those not sent as images. */
  files: string[];
  /** How many images follow the text. */
  images: number;
}

export function analysisPrompt(locale: Locale, input: PromptInput) {
  const lang = AI_LANGUAGE[locale];
  const system =
    "You organize messages and photos a user received through chat bots. Reply with JSON only, no other text:\n" +
    '{"category": string, "tags": string[], "summary": string, "ocr_text": string, "fields": {' +
    '"amounts": string[], "dates": string[], "phones": string[], "emails": string[], "urls": string[], ' +
    '"addresses": string[], "codes": string[], "people": string[]}}\n' +
    "category: one of the existing categories, exactly as written, whenever one fits; only if none fits, " +
    `a short new one in ${lang}.\n` +
    `tags: 0-5 short tags in ${lang} (names of products, places and brands stay as they are).\n` +
    `summary: one sentence in ${lang} saying what the message is about; describe what the images show.\n` +
    'ocr_text: all legible text in the images, verbatim, keeping line breaks; "" when there is none.\n' +
    "fields: values found in the message or the images, copied as written: amounts of money with currency, " +
    "dates and times, phone numbers, email addresses, links, postal addresses, codes (order, tracking, " +
    "invoice, flight, booking or verification numbers), and names of people. Leave a list empty rather than guess.";
  const prompt =
    `Existing categories: ${input.categories.join(", ") || "(none)"}\n` +
    `Chat: ${input.chatType}\nSender: ${input.sender || "(unknown)"}\n` +
    `Sent: ${new Date(input.sentAt).toISOString()}\n` +
    `Files: ${input.files.join(", ") || "(none)"}\n` +
    `Images attached below: ${input.images}\n` +
    `Message text:\n${input.text || "(no text)"}`;
  return { system, prompt };
}
