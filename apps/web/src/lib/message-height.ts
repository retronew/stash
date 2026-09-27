import type { Message } from "@stash/shared";

/**
 * A first guess at a message card's height (px, with the gap below it) for
 * the virtual list; the real height is measured once it renders.
 */
export function estimateMessageHeight(msg: Message): number {
  const text = msg.text ? 24 + Math.min(Math.ceil(msg.text.length / 60), 12) * 20 : 0;
  // Tiles are square, 3 or 4 to a row.
  const tiles = msg.attachments.length ? Math.ceil(msg.attachments.length / 4) * 220 : 0;
  const insights = msg.category || msg.summary ? 56 : 0;
  return 60 + text + tiles + insights + 12;
}
