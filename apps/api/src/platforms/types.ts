import type { AttachmentKind, ChatType, Platform } from "@stash/shared";
import type { BotAccountRow } from "#accounts";

/** A message in platform-neutral form, ready for ingest.ts. */
export interface IncomingMessage {
  externalId: string;
  eventType: string;
  chatType: ChatType;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
  raw: string;
  attachments: IncomingAttachment[];
}

export interface IncomingAttachment {
  kind: AttachmentKind;
  url: string;
  filename: string;
  contentType: string;
  size: number | null;
  width: number | null;
  height: number | null;
}

export interface WebhookResult {
  /** What to answer the platform with, once the messages are saved. */
  response: Response;
  messages: IncomingMessage[];
}

export interface PlatformAdapter {
  platform: Platform;
  /**
   * Verifies and parses one webhook call. `body` is the raw request body
   * (signatures cover the exact bytes). Never downloads anything.
   */
  handleWebhook(req: Request, body: string, account: BotAccountRow): Promise<WebhookResult>;
}
