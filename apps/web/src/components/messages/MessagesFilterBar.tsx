import { DownloadIcon } from "lucide-react";
import { CHAT_TYPES, type Account, type ChatSummary, type ChatType, type Platform } from "@stash/shared";
import { Button } from "#components/ui/button";
import { MultiSelectFilter } from "#components/filters/MultiSelectFilter";
import { SingleSelectFilter } from "#components/filters/SingleSelectFilter";
import { ActiveFilters, chipsFor, type ActiveFilter } from "#components/filters/ActiveFilters";
import { accountOptions, chatOptions, enumOptions, optionLabel } from "#components/filters/options";
import type { MessageFilters, Period } from "#lib/queries";
import { chatTypeLabel } from "#lib/labels";
import { platformList } from "#lib/platforms";
import type { CategoryOption } from "#lib/categories";
import { m } from "#lib/i18n";

export const EMPTY_MESSAGE_FILTERS: MessageFilters = {
  platforms: [],
  accounts: [],
  chatTypes: [],
  chatIds: [],
  categories: [],
  media: "all",
  period: "all",
};

interface Props {
  filters: MessageFilters;
  onChange: (patch: Partial<MessageFilters>) => void;
  onClear: () => void;
  accounts: Account[];
  chats: ChatSummary[];
  categories: CategoryOption[];
  /** Packs the files these filters match. */
  onExport: () => void;
}

/** Time and files (one of); platform, bot and chat type (any of); the export button; the active filters as chips. */
export function MessagesFilterBar({ filters, onChange, onClear, accounts, chats, categories, onExport }: Props) {
  const media: { value: MessageFilters["media"]; label: string }[] = [
    { value: "all", label: m.filter_media_all() },
    { value: "media", label: m.view_media() },
    { value: "failed", label: m.view_failed() },
  ];
  const periods: { value: Period; label: string }[] = [
    { value: "all", label: m.period_all() },
    { value: "today", label: m.period_today() },
    { value: "7d", label: m.period_7d() },
    { value: "30d", label: m.period_30d() },
    { value: "year", label: m.period_year() },
  ];
  const platforms = platformList().map((p) => ({ value: p.id, label: p.label() }));
  const bots = accountOptions(accounts);
  const chatTypes = enumOptions(CHAT_TYPES, chatTypeLabel);
  const conversations = chatOptions(chats, accounts, filters.accounts);
  const setChatIds = (chatIds: string[]) => onChange({ chatIds });
  const categoryOptions = categories.map((c) => ({ value: c.category, label: c.category, count: c.count }));
  const setCategories = (v: string[]) => onChange({ categories: v });
  const setPlatforms = (v: string[]) => onChange({ platforms: v as Platform[] });
  const setBots = (accounts: string[]) => onChange({ accounts });
  const setChats = (v: string[]) => onChange({ chatTypes: v as ChatType[] });

  const chips: ActiveFilter[] = [
    ...(filters.period === "all"
      ? []
      : [{ key: "period", label: optionLabel(periods, filters.period), onRemove: () => onChange({ period: "all" }) }]),
    ...(filters.media === "all"
      ? []
      : [{ key: "media", label: optionLabel(media, filters.media), onRemove: () => onChange({ media: "all" }) }]),
    ...chipsFor("category", filters.categories, (v) => v, setCategories),
    ...chipsFor("platform", filters.platforms, (v) => optionLabel(platforms, v), setPlatforms),
    ...chipsFor("bot", filters.accounts, (v) => optionLabel(bots, v), setBots),
    ...chipsFor("chat", filters.chatTypes, (v) => chatTypeLabel(v as ChatType), setChats),
    ...chipsFor("chatid", filters.chatIds, (v) => optionLabel(conversations, v), setChatIds),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:flex-wrap">
        <SingleSelectFilter label={m.filter_period()} options={periods} value={filters.period} onChange={(period) => onChange({ period })} />
        <SingleSelectFilter label={m.filter_media()} options={media} value={filters.media} onChange={(v) => onChange({ media: v })} />
        <MultiSelectFilter label={m.filter_category()} options={categoryOptions} selected={filters.categories} onChange={setCategories} />
        <MultiSelectFilter label={m.filter_platform()} options={platforms} selected={filters.platforms} onChange={setPlatforms} />
        <MultiSelectFilter label={m.filter_bot()} options={bots} selected={filters.accounts} onChange={setBots} />
        <MultiSelectFilter label={m.filter_chat_type()} options={chatTypes} selected={filters.chatTypes} onChange={setChats} />
        <MultiSelectFilter
          label={m.filter_chat()}
          options={conversations}
          selected={filters.chatIds}
          onChange={setChatIds}
          className="sm:w-40"
        />
        <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onExport}>
          <DownloadIcon />
          <span className="max-sm:sr-only">{m.export_button()}</span>
        </Button>
      </div>
      <ActiveFilters filters={chips} onClearAll={onClear} />
    </div>
  );
}
