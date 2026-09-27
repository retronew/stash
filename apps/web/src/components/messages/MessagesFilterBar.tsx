import { CHAT_TYPES, type Account, type ChatType } from "@stash/shared";
import { MultiSelectFilter } from "#components/filters/MultiSelectFilter";
import { SingleSelectFilter } from "#components/filters/SingleSelectFilter";
import { ActiveFilters, chipsFor, type ActiveFilter } from "#components/filters/ActiveFilters";
import { accountOptions, enumOptions, optionLabel } from "#components/filters/options";
import type { MessageFilters } from "#lib/queries";
import { chatTypeLabel } from "#lib/labels";
import { m } from "#lib/i18n";

export const EMPTY_MESSAGE_FILTERS: MessageFilters = { accounts: [], chatTypes: [], media: "all" };

interface Props {
  filters: MessageFilters;
  onChange: (patch: Partial<MessageFilters>) => void;
  onClear: () => void;
  accounts: Account[];
}

/** Files (one of), bots and chat types (any of), and the active filters as chips. */
export function MessagesFilterBar({ filters, onChange, onClear, accounts }: Props) {
  const media: { value: MessageFilters["media"]; label: string }[] = [
    { value: "all", label: m.filter_media_all() },
    { value: "media", label: m.view_media() },
    { value: "failed", label: m.view_failed() },
  ];
  const bots = accountOptions(accounts);
  const chats = enumOptions(CHAT_TYPES, chatTypeLabel);

  const chips: ActiveFilter[] = [
    ...(filters.media === "all"
      ? []
      : [{ key: "media", label: optionLabel(media, filters.media), onRemove: () => onChange({ media: "all" }) }]),
    ...chipsFor("bot", filters.accounts, (v) => optionLabel(bots, v), (accounts) => onChange({ accounts })),
    ...chipsFor("chat", filters.chatTypes, (v) => chatTypeLabel(v as ChatType), (v) =>
      onChange({ chatTypes: v as ChatType[] }),
    ),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:flex-wrap">
        <SingleSelectFilter
          label={m.filter_media()}
          options={media}
          value={filters.media}
          onChange={(v) => onChange({ media: v })}
        />
        {bots.length > 1 && (
          <MultiSelectFilter label={m.filter_bot()} options={bots} selected={filters.accounts} onChange={(accounts) => onChange({ accounts })} />
        )}
        <MultiSelectFilter
          label={m.filter_chat_type()}
          options={chats}
          selected={filters.chatTypes}
          onChange={(v) => onChange({ chatTypes: v as ChatType[] })}
        />
      </div>
      <ActiveFilters filters={chips} onClearAll={onClear} />
    </div>
  );
}
