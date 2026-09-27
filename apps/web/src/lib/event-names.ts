import { m } from "#lib/i18n";

type Message = () => string;
const catalog = m as unknown as Record<string, Message | undefined>;

/**
 * A readable name for a platform event ("C2C_MESSAGE_CREATE" → "单聊消息").
 * Messages are keyed event_<platform>_<name in lower case>; events without
 * a translation (e.g. ones the platform adds later) show their raw name.
 */
export function eventName(platform: string, type: string): string {
  if (!type) return "—";
  const fn = catalog[`event_${platform}_${type.toLowerCase()}`];
  return typeof fn === "function" ? fn() : type;
}
