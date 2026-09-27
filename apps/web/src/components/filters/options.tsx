import type { Account } from "@stash/shared";
import { BotAvatar } from "#components/BotAvatar";
import { accountLabel } from "#lib/labels";
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

/** A fixed set of values as filter options. */
export function enumOptions<T extends string>(values: readonly T[], label: (value: T) => string): FilterOption[] {
  return values.map((value) => ({ value, label: label(value) }));
}

/** The label of `value` among `options`, or the value itself. */
export function optionLabel(options: FilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
