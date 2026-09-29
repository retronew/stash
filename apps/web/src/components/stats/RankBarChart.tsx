import { EvilBarChart } from "#components/evilcharts/charts/recharts-bar-chart";
import { ChartEmpty, type ChartRow } from "#components/stats/StatCharts";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const ROW_HEIGHT = 28;
const config = { count: { label: m.stats_count(), ...chartColor("var(--chart-2)") } };

const truncate = (label: string, max = 10) => (label.length > max ? `${label.slice(0, max)}…` : label);

/**
 * A ranking as horizontal bars, largest first, one row per entry. Solid bars:
 * a gradient would fade the short ones out.
 */
export function RankBarChart({ rows }: { rows: ChartRow[] }) {
  if (rows.length === 0) return <ChartEmpty />;
  const data = rows.map((r) => ({ ...r, label: truncate(r.label) }));
  return (
    <div style={{ height: data.length * ROW_HEIGHT + 8 }}>
      <EvilBarChart
        config={config}
        data={data}
        layout="horizontal"
        barRadius={5}
        className="aspect-auto h-full"
        chartProps={{ barSize: 12, margin: { left: -8 } }}
      >
        <EvilBarChart.XAxis dataKey="count" hide />
        <EvilBarChart.YAxis dataKey="label" width={116} tickMargin={10} />
        <EvilBarChart.Tooltip />
        <EvilBarChart.Bar dataKey="count" />
      </EvilBarChart>
    </div>
  );
}
