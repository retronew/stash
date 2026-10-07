import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { ATTACHMENT_KINDS, CHAT_TYPES, type Account, type AttachmentKind, type ChatType, type Platform } from "@stash/shared";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Checkbox } from "#components/ui/checkbox";
import { RadioGroup, Radio } from "#components/ui/radio-group";
import { Skeleton } from "#components/ui/skeleton";
import { MultiSelectFilter } from "#components/filters/MultiSelectFilter";
import { accountOptions, chatOptions, enumOptions } from "#components/filters/options";
import { dateRange } from "#lib/date-range";
import { type ExportLayout, type ExportOptions } from "#lib/export-plan";
import { chatsQuery, exportSummaryQuery } from "#lib/queries";
import { platformList } from "#lib/platforms";
import { chatTypeLabel, kindLabel } from "#lib/labels";
import { formatBytes } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  value: ExportOptions;
  onChange: (patch: Partial<ExportOptions>) => void;
  accounts: Account[];
}

const LAYOUTS: { value: ExportLayout; label: () => string; example: string }[] = [
  { value: "bot", label: () => m.export_layout_bot(), example: "Bot/2026-09/0927-153012_Alice_42.jpg" },
  { value: "chat", label: () => m.export_layout_chat(), example: "Bot/group-8F2A…/0927-153012_Alice_42.jpg" },
  { value: "flat", label: () => m.export_layout_flat(), example: "0927-153012_Alice_42.jpg" },
];

/** What to export and how to lay it out, with a live count of what that means. */
export function ExportForm({ value, onChange, accounts }: Props) {
  const id = useId();
  const platforms = platformList();
  const { since, until } = dateRange(value.from, value.to);
  const summary = useQuery(
    exportSummaryQuery({
      platforms: value.platforms,
      accounts: value.accounts,
      chatTypes: value.chatTypes,
      chatIds: value.chatIds,
      since,
      until,
      kinds: value.kinds,
    }),
  );
  const { data: chats } = useQuery(chatsQuery);
  // Bots of the chosen platforms, conversations of the chosen bots.
  const bots = accounts.filter((a) => value.platforms.length === 0 || value.platforms.includes(a.platform));
  const conversations = chatOptions(
    (chats ?? []).filter((c) => value.platforms.length === 0 || value.platforms.includes(c.platform)),
    accounts,
    value.accounts,
  );
  const toggleKind = (kind: AttachmentKind, on: boolean) =>
    onChange({ kinds: on ? [...value.kinds, kind] : value.kinds.filter((k) => k !== kind) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <MultiSelectFilter
          label={m.filter_platform()}
          options={platforms.map((p) => ({ value: p.id, label: p.label() }))}
          selected={value.platforms}
          onChange={(v) => onChange({ platforms: v as Platform[] })}
        />
        <MultiSelectFilter
          label={m.filter_bot()}
          options={accountOptions(bots)}
          selected={value.accounts}
          onChange={(v) => onChange({ accounts: v })}
        />
        <MultiSelectFilter
          label={m.filter_chat()}
          options={conversations}
          selected={value.chatIds}
          onChange={(v) => onChange({ chatIds: v })}
          className="sm:w-40"
        />
        <MultiSelectFilter
          label={m.filter_chat_type()}
          options={enumOptions(CHAT_TYPES, chatTypeLabel)}
          selected={value.chatTypes}
          onChange={(v) => onChange({ chatTypes: v as ChatType[] })}
        />
      </div>

      <Field>
        <FieldLabel>{m.export_dates()}</FieldLabel>
        <div className="flex w-full items-center gap-2">
          <Input type="date" aria-label={m.export_from()} value={value.from} max={value.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label={m.export_to()} value={value.to} min={value.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
        </div>
      </Field>

      <Field>
        <FieldLabel>{m.export_kinds()}</FieldLabel>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ATTACHMENT_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={value.kinds.includes(k)} onCheckedChange={(on) => toggleKind(k, !!on)} />
              {kindLabel(k)}
            </label>
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel>{m.export_layout()}</FieldLabel>
        <RadioGroup value={value.layout} onValueChange={(v) => onChange({ layout: v as ExportLayout })} className="gap-2">
          {LAYOUTS.map((l) => (
            <label key={l.value} className="flex items-start gap-2 text-sm">
              <Radio value={l.value} className="mt-0.5" />
              <span className="min-w-0">
                <span>{l.label()}</span>
                <span className="block truncate font-mono text-muted-foreground text-xs">{l.example}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Field>

      <label htmlFor={`${id}-json`} className="flex items-start gap-2 text-sm">
        <Checkbox id={`${id}-json`} className="mt-0.5" checked={value.includeMessages} onCheckedChange={(on) => onChange({ includeMessages: !!on })} />
        <span>
          {m.export_include_messages()}
          <span className="block text-muted-foreground text-xs">{m.export_include_messages_hint()}</span>
        </span>
      </label>

      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
        {summary.data ? (
          <p className="animate-fade-in">
            {m.export_summary({ files: summary.data.files, size: formatBytes(summary.data.bytes), messages: summary.data.messages })}
            {summary.data.unsaved > 0 && (
              <span className="text-muted-foreground"> · {m.export_summary_unsaved({ count: summary.data.unsaved })}</span>
            )}
          </p>
        ) : (
          <Skeleton className="my-0.5 h-4 w-64" />
        )}
      </div>
    </div>
  );
}
