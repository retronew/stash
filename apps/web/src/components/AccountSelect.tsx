import type { Account } from "@stash/shared";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { m } from "#lib/i18n";

const ALL = "__all__";

export const accountLabel = (a: Account) => a.name || a.appId || a.id.slice(0, 8);

interface Props {
  accounts: Account[];
  /** "" = all bots. */
  value: string;
  onChange: (accountId: string) => void;
}

/** Bot filter for lists; hidden while there is only one bot. */
export function AccountSelect({ accounts, value, onChange }: Props) {
  if (accounts.length < 2) return null;
  const items: Record<string, string> = { [ALL]: m.filter_all_accounts() };
  for (const a of accounts) items[a.id] = accountLabel(a);

  return (
    <Select value={value || ALL} items={items} onValueChange={(v) => onChange(v === ALL || !v ? "" : String(v))}>
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {Object.entries(items).map(([id, label]) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
