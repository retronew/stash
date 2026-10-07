import type { Account, ChatSummary, SenderSummary } from "@stash/shared";
import { BotAvatar } from "#components/BotAvatar";
import { accountLabel, chatTypeLabel } from "#lib/labels";
import type { FilterOption } from "#components/filters/MultiSelectFilter";

/** Bots as filter options, with their picture and message count. */
export function accountOptions(accounts: Account[]): FilterOption[] {
  return accounts.map((a) => ({
    value: a.id,
    label: accountLabel(a),
    count: a.messageCount,
    icon: <BotAvatar account={a} platform={a.platform} className="size-4" />,
  }));
}

/**
 * Conversations as filter options: "群聊 · 8F2A…" or the person's name,
 * with the bot's picture and the message count. `accounts` narrows them to
 * those bots (empty = all).
 */
export function chatOptions(chats: ChatSummary[], accounts: Account[], onlyAccounts: string[] = []): FilterOption[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return chats
    .filter((c) => onlyAccounts.length === 0 || onlyAccounts.includes(c.accountId))
    .map((c) => ({
      value: c.chatId,
      label: `${chatTypeLabel(c.chatType)} · ${c.name || shortId(c.chatId)}`,
      count: c.messages,
      icon: <BotAvatar account={byId.get(c.accountId)} platform={c.platform} className="size-4" />,
    }));
}

/** People as filter options: their name (or a short id) and message count. */
export function senderOptions(senders: SenderSummary[]): FilterOption[] {
  return senders.map((s) => ({
    value: s.senderId,
    label: s.name || shortId(s.senderId),
    count: s.messages,
    icon: <BotAvatar platform={s.platform} className="size-4" />,
  }));
}

/** Platform ids are long opaque strings; the start is enough to tell them apart. */
export const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

/** A fixed set of values as filter options. */
export function enumOptions<T extends string>(values: readonly T[], label: (value: T) => string): FilterOption[] {
  return values.map((value) => ({ value, label: label(value) }));
}

/** The label of `value` among `options`, or the value itself. */
export function optionLabel(options: FilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
