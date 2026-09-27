import { RotateCwIcon, SparklesIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { StatTile } from "#components/StatTile";
import { Confirm } from "#components/Confirm";
import { useAnalysis } from "#hooks/useAnalysis";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** How far analysis has got, and buttons to analyze the backlog or retry failures. */
export function AnalysisStatusCard() {
  const { stats, statsError, queue } = useAnalysis(true);
  const value = (n: number | undefined) => (n === undefined ? undefined : String(n));

  async function reanalyzeAll() {
    const ok = await Confirm.call({
      title: m.analysis_reanalyze_title(),
      message: m.analysis_reanalyze_message(),
      confirmLabel: m.analysis_reanalyze(),
    });
    if (ok) await queue("all");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.analysis_status_title()}</CardTitle>
        <CardDescription>
          {stats && !stats.configured ? m.analysis_not_configured() : m.analysis_status_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statsError && <p className="text-destructive text-xs">{m.load_failed({ error: errorMessage(statsError) })}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile compact label={m.analysis_done()} value={value(stats?.done)} />
          <StatTile compact label={m.analysis_not_analyzed()} value={value(stats?.notAnalyzed)} />
          <StatTile compact label={m.analysis_in_progress()} value={value(stats?.pending)} />
          <StatTile compact label={m.analysis_failed()} value={value(stats?.failed)} />
          <StatTile
            compact
            label={m.analysis_today()}
            value={stats ? (stats.dailyLimit ? `${stats.today} / ${stats.dailyLimit}` : String(stats.today)) : undefined}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!stats?.configured || !stats.notAnalyzed} onClick={() => queue("unanalyzed")}>
            <SparklesIcon />
            {m.analysis_run_backlog({ count: stats?.notAnalyzed ?? 0 })}
          </Button>
          <Button variant="outline" size="sm" disabled={!stats?.configured || !stats.failed} onClick={() => queue("failed")}>
            <RotateCwIcon />
            {m.analysis_retry_failed({ count: stats?.failed ?? 0 })}
          </Button>
          <Button variant="ghost" size="sm" disabled={!stats?.configured || !stats.total} onClick={reanalyzeAll}>
            {m.analysis_reanalyze()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
