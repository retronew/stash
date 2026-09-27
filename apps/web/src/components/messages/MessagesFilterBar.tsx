import type { Account } from "@stash/shared";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import { ScrollFade } from "#components/ScrollFade";
import { AccountSelect } from "#components/AccountSelect";
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
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <ScrollFade className="max-w-full">
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
      </ScrollFade>
      <AccountSelect accounts={accounts} value={account} onChange={onAccountChange} />
    </div>
  );
}
