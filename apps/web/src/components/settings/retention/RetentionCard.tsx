import { useState } from "react";
import { DatabaseIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";
import { Confirm } from "#components/Confirm";
import { useRetention } from "#hooks/useRetention";
import type { RetentionTarget } from "#lib/queries";
import { errorMessage, toastError, toastSuccess } from "#lib/api";
import { formatBytes, formatDate } from "#lib/format";
import { intlLocale, m } from "#lib/i18n";

const presets = (): Record<string, string> => ({
  "7": m.retention_days({ days: 7 }),
  "30": m.retention_days({ days: 30 }),
  "90": m.retention_days({ days: 90 }),
  "180": m.retention_days({ days: 180 }),
  "365": m.retention_years({ years: 1 }),
  "0": m.retention_forever(),
  custom: m.retention_custom(),
});

const retentionLabel = (days: number) => (days === 0 ? m.retention_forever() : m.retention_days({ days }));

interface Props {
  target: RetentionTarget;
  title: string;
  description: string;
}

/** How long one kind of record is kept, with its current usage (PickIt's audit retention). */
export function RetentionCard({ target, title, description }: Props) {
  const { info, maxDays, error, save } = useRetention(target);
  const [custom, setCustom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function change(days: number) {
    if (!info || days === info.days) return;
    const shorter = days !== 0 && (info.days === 0 || days < info.days);
    if (shorter) {
      const ok = await Confirm.call({
        title: m.retention_confirm_title({ days }),
        message: m.retention_confirm_message({ days }),
        confirmLabel: m.retention_confirm(),
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const { deleted } = await save(days);
      setCustom(null);
      toastSuccess(m.retention_saved({ name: title, retention: retentionLabel(days) }), {
        description: deleted ? m.retention_pruned({ count: deleted }) : undefined,
        id: `retention-${target}`,
      });
    } catch (err) {
      toastError(m.retention_failed(), err, { id: `retention-${target}` });
    } finally {
      setSaving(false);
    }
  }

  const all = presets();
  const current = info ? String(info.days) : "";
  const items = !info || current in all ? all : { ...all, custom: retentionLabel(info.days) };
  const selectValue = custom !== null ? "custom" : current in all ? current : "custom";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-xs">{m.load_failed({ error: errorMessage(error) })}</p>}
        {!info && !error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-3 py-2.5">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        )}
        {info && (
          <div className="flex animate-fade-in flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <DatabaseIcon className="size-4 shrink-0" />
              <span>
                {m.retention_usage({ count: info.stats.count.toLocaleString(intlLocale()), size: formatBytes(info.stats.bytes) })}
                {info.stats.oldest != null && ` · ${m.retention_oldest({ date: formatDate(info.stats.oldest) })}`}
              </span>
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground max-sm:sr-only">{m.retention_label()}</span>
              <Select
                value={selectValue}
                items={items}
                disabled={saving}
                onValueChange={(v) => {
                  if (v === "custom") setCustom(current === "0" ? "" : current);
                  else if (v != null) change(Number(v));
                }}
              >
                <SelectTrigger size="sm" className="w-auto min-w-28 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {Object.entries(items).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </span>
            {custom !== null && (
              <form
                className="flex w-full items-center justify-end gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const days = Number(custom);
                  if (Number.isInteger(days) && days >= 1 && days <= maxDays) change(days);
                }}
              >
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  max={maxDays}
                  className="w-20"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-label={m.retention_days_label()}
                  autoFocus
                />
                <span className="text-muted-foreground">{m.retention_day_unit()}</span>
                <Button size="sm" type="submit" disabled={saving || !custom}>
                  {m.common_save()}
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setCustom(null)}>
                  {m.common_cancel()}
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
