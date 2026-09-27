import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { Progress } from "#components/ui/progress";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "#components/ui/select";
import { Skeleton } from "#components/ui/skeleton";
import { useAnalysis } from "#hooks/useAnalysis";
import { m } from "#lib/i18n";

type Mode = "missing" | "all";

/** Rebuilds the vector index with the current embedding model, as in PickIt. */
export function ReembedCard() {
  const { stats, reembed } = useAnalysis(true);
  const [mode, setMode] = useState<Mode>("missing");
  const [busy, setBusy] = useState(false);
  const labels: Record<Mode, string> = { missing: m.reembed_mode_missing(), all: m.reembed_mode_all() };
  const total = stats?.embeddable ?? 0;
  const done = Math.min(stats?.embedded ?? 0, total);

  async function start() {
    setBusy(true);
    await reembed(mode);
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.reembed_title()}</CardTitle>
        <CardDescription>{stats && !stats.embeddingModel ? m.reembed_no_model() : m.reembed_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!stats ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>{m.reembed_progress({ done, total })}</span>
              {stats.embeddingModel && <span className="truncate font-mono">{stats.embeddingModel}</span>}
            </div>
            <Progress value={total ? (done / total) * 100 : 0} />
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)} items={labels}>
          <SelectTrigger size="sm" className="w-auto min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {(Object.keys(labels) as Mode[]).map((key) => (
              <SelectItem key={key} value={key}>
                {labels[key]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Button size="sm" disabled={!stats?.embeddingModel || busy} onClick={start}>
          {m.reembed_start()}
        </Button>
      </CardFooter>
    </Card>
  );
}
