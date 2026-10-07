import { useState } from "react";
import { CheckSquareIcon, DownloadIcon, ListFilterIcon } from "lucide-react";
import { Badge } from "#components/ui/badge";
import {
  ATTACHMENT_KINDS,
  CHAT_TYPES,
  type Account,
  type AttachmentKind,
  type ChatSummary,
  type ChatType,
  type Platform,
  type SenderSummary,
} from "@stash/shared";
import { Button } from "#components/ui/button";
import { MultiSelectFilter } from "#components/filters/MultiSelectFilter";
import { SingleSelectFilter } from "#components/filters/SingleSelectFilter";
import { ActiveFilters, chipsFor, type ActiveFilter } from "#components/filters/ActiveFilters";
import { accountOptions, chatOptions, enumOptions, optionLabel, senderOptions } from "#components/filters/options";
import { DateRangePicker } from "#components/DateRangePicker";
import type { MessageFilters } from "#lib/queries";
import { AI_FILTER_STATES, aiStateLabel, chatTypeLabel, kindLabel, type AiFilterState } from "#lib/labels";
import { platformList } from "#lib/platforms";
import type { CategoryOption } from "#lib/categories";
import { intlLocale, m } from "#lib/i18n";

export const EMPTY_MESSAGE_FILTERS: MessageFilters = {
  platforms: [],
  accounts: [],
  chatTypes: [],
  chatIds: [],
  categories: [],
  tags: [],
  kinds: [],
  senders: [],
  ai: [],
  media: "all",
  from: "",
  to: "",
};

const dateLabel = new Intl.DateTimeFormat(intlLocale(), { month: "short", day: "numeric" });
const shortDate = (d: string) => (d ? dateLabel.format(new Date(`${d}T00:00:00`)) : "…");

interface Props {
  filters: MessageFilters;
  onChange: (patch: Partial<MessageFilters>) => void;
  onClear: () => void;
  accounts: Account[];
  chats: ChatSummary[];
  senders: SenderSummary[];
  categories: CategoryOption[];
  tags: { tag: string; count: number }[];
  /** Packs the files these filters match. */
  onExport: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

/** Dates and files (one of); kinds, senders, AI state, platform, bot and chat type (any of); the export button; the active filters as chips. */
export function MessagesFilterBar({ filters, onChange, onClear, accounts, chats, senders, categories, tags, onExport, selectMode, onToggleSelectMode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const media: { value: MessageFilters["media"]; label: string }[] = [
    { value: "all", label: m.filter_media_all() },
    { value: "media", label: m.view_media() },
    { value: "text", label: m.view_text_only() },
    { value: "failed", label: m.view_failed() },
  ];
  const platforms = platformList().map((p) => ({ value: p.id, label: p.label() }));
  const bots = accountOptions(accounts);
  const chatTypes = enumOptions(CHAT_TYPES, chatTypeLabel);
  const conversations = chatOptions(chats, accounts, filters.accounts);
  const setChatIds = (chatIds: string[]) => onChange({ chatIds });
  const categoryOptions = categories.map((c) => ({ value: c.category, label: c.category, count: c.count }));
  const setCategories = (v: string[]) => onChange({ categories: v });
  const tagOptions = tags.map((t) => ({ value: t.tag, label: `#${t.tag}`, count: t.count }));
  const setTags = (v: string[]) => onChange({ tags: v });
  const setPlatforms = (v: string[]) => onChange({ platforms: v as Platform[] });
  const setBots = (accounts: string[]) => onChange({ accounts });
  const setChats = (v: string[]) => onChange({ chatTypes: v as ChatType[] });
  const kinds = enumOptions(ATTACHMENT_KINDS, kindLabel);
  const setKinds = (v: string[]) => onChange({ kinds: v as AttachmentKind[] });
  const people = senderOptions(senders);
  const setSenders = (v: string[]) => onChange({ senders: v });
  const aiStates = enumOptions(AI_FILTER_STATES, aiStateLabel);
  const setAi = (v: string[]) => onChange({ ai: v });
  const clearDates = () => onChange({ from: "", to: "" });

  const chips: ActiveFilter[] = [
    ...(filters.from || filters.to
      ? [{ key: "dates", label: `${shortDate(filters.from)} – ${shortDate(filters.to || filters.from)}`, onRemove: clearDates }]
      : []),
    ...(filters.media === "all"
      ? []
      : [{ key: "media", label: optionLabel(media, filters.media), onRemove: () => onChange({ media: "all" }) }]),
    ...chipsFor("kind", filters.kinds, (v) => kindLabel(v as AttachmentKind), setKinds),
    ...chipsFor("sender", filters.senders, (v) => optionLabel(people, v), setSenders),
    ...chipsFor("ai", filters.ai, (v) => aiStateLabel(v as AiFilterState), setAi),
    ...chipsFor("category", filters.categories, (v) => v, setCategories),
    ...chipsFor("tag", filters.tags, (v) => `#${v}`, setTags),
    ...chipsFor("platform", filters.platforms, (v) => optionLabel(platforms, v), setPlatforms),
    ...chipsFor("bot", filters.accounts, (v) => optionLabel(bots, v), setBots),
    ...chipsFor("chat", filters.chatTypes, (v) => chatTypeLabel(v as ChatType), setChats),
    ...chipsFor("chatid", filters.chatIds, (v) => optionLabel(conversations, v), setChatIds),
  ];

  const controls = (
    <>
      <DateRangePicker from={filters.from} to={filters.to} onChange={onChange} className="max-sm:col-span-2 max-sm:[&>button:first-child]:flex-1" />
      <SingleSelectFilter label={m.filter_media()} options={media} value={filters.media} onChange={(v) => onChange({ media: v })} />
      <MultiSelectFilter label={m.filter_kind()} options={kinds} selected={filters.kinds} onChange={setKinds} />
      <MultiSelectFilter label={m.filter_sender()} options={people} selected={filters.senders} onChange={setSenders} className="sm:w-40" />
      <MultiSelectFilter label={m.filter_ai()} options={aiStates} selected={filters.ai} onChange={setAi} />
      <MultiSelectFilter label={m.filter_category()} options={categoryOptions} selected={filters.categories} onChange={setCategories} />
      <MultiSelectFilter label={m.filter_tag()} options={tagOptions} selected={filters.tags} onChange={setTags} />
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
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {/* Phones: the filters sit behind a toggle, as on PickIt's audit page. */}
        <Button
          variant={expanded ? "secondary" : "outline"}
          size="sm"
          className="shrink-0 sm:hidden"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <ListFilterIcon />
          {m.filters_toggle()}
          {chips.length > 0 && <Badge size="sm">{chips.length}</Badge>}
        </Button>
        {/* Wide screens: the filters wrap among themselves, so the button on the right keeps its place. */}
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex">{controls}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <DownloadIcon />
            <span className="max-sm:sr-only">{m.export_button()}</span>
          </Button>
          <Button variant={selectMode ? "default" : "secondary"} size="sm" onClick={onToggleSelectMode}>
            <CheckSquareIcon />
            <span className="max-sm:sr-only">{m.action_select()}</span>
          </Button>
        </div>
      </div>
      {expanded && <div className="grid animate-fade-in grid-cols-2 gap-2 sm:hidden [&>*]:w-full">{controls}</div>}
      <ActiveFilters filters={chips} onClearAll={onClear} />
    </div>
  );
}
