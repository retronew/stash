import type { Account, AttachmentKind, AttachmentStatus } from "@stash/shared";
import { ToggleGroup, ToggleGroupItem } from "#components/ui/toggle-group";
import { ScrollFade } from "#components/ScrollFade";
import { AccountSelect } from "#components/AccountSelect";
import { kindLabel, statusLabel } from "#lib/labels";
import { m } from "#lib/i18n";

const ALL = "all";
const STATUSES: AttachmentStatus[] = ["pending", "downloading", "failed", "stored"];
const KINDS: AttachmentKind[] = ["image", "video", "audio", "file"];

interface Props {
  status: AttachmentStatus | undefined;
  onStatusChange: (status: AttachmentStatus | undefined) => void;
  kind: AttachmentKind | undefined;
  onKindChange: (kind: AttachmentKind | undefined) => void;
  account: string;
  onAccountChange: (account: string) => void;
  accounts: Account[];
}

export function TasksFilterBar(props: Props) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <ScrollFade className="max-w-full">
        <ToggleGroup
          aria-label={m.filter_status()}
          variant="outline"
          size="sm"
          value={[props.status ?? ALL]}
          onValueChange={(v) => v[0] && props.onStatusChange(v[0] === ALL ? undefined : (v[0] as AttachmentStatus))}
        >
          <ToggleGroupItem value={ALL}>{m.view_all()}</ToggleGroupItem>
          {STATUSES.map((s) => (
            <ToggleGroupItem key={s} value={s}>
              {statusLabel(s)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ScrollFade>
      <ScrollFade className="max-w-full">
        <ToggleGroup
          aria-label={m.filter_kind()}
          variant="outline"
          size="sm"
          value={[props.kind ?? ALL]}
          onValueChange={(v) => v[0] && props.onKindChange(v[0] === ALL ? undefined : (v[0] as AttachmentKind))}
        >
          <ToggleGroupItem value={ALL}>{m.view_all()}</ToggleGroupItem>
          {KINDS.map((k) => (
            <ToggleGroupItem key={k} value={k}>
              {kindLabel(k)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ScrollFade>
      <AccountSelect accounts={props.accounts} value={props.account} onChange={props.onAccountChange} />
    </div>
  );
}
