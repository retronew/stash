import type { Account } from "@stash/shared";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import type { MessageFilters } from "#lib/queries";
import { m } from "#lib/i18n";

/** all: every message; media: with attachments; failed: with a failed download. */
export type MessageView = "all" | "media" | "failed";

export function filtersFor(view: MessageView, account: string): MessageFilters {
  return {
    account: account || undefined,
    media: view === "media" || undefined,
    status: view === "failed" ? "failed" : undefined,
  };
}

const VIEWS: { value: MessageView; label: () => string }[] = [
  { value: "all", label: () => m.view_all() },
  { value: "media", label: () => m.view_media() },
  { value: "failed", label: () => m.view_failed() },
];

interface Props {
  view: MessageView;
  onViewChange: (view: MessageView) => void;
  account: string;
  onAccountChange: (account: string) => void;
  accounts: Account[];
}

export function MessagesFilterBar({ view, onViewChange, account, onAccountChange, accounts }: Props) {
  const ALL = "__all__";
  const items: Record<string, string> = { [ALL]: m.filter_all_accounts() };
  for (const a of accounts) items[a.id] = a.name || a.appId || a.id.slice(0, 8);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        aria-label={m.filter_view()}
        variant="outline"
        size="sm"
        value={[view]}
        onValueChange={(v) => v[0] && onViewChange(v[0] as MessageView)}
      >
        {VIEWS.map((v) => (
          <ToggleGroupItem key={v.value} value={v.value}>
            {v.label()}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {accounts.length > 1 && (
        <Select value={account || ALL} items={items} onValueChange={(v) => onAccountChange(v === ALL || !v ? "" : String(v))}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {Object.entries(items).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      )}
    </div>
  );
}
