import { EvilAreaChart } from "#components/evilcharts/charts/recharts-area-chart";
import { ChartEmpty, type ChartRow } from "#components/stats/StatCharts";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const config = { count: { label: m.stats_count(), ...chartColor("var(--chart-2)") } };

/** Counts over time (days or months) as a trend line. Missing periods should already be filled as 0. */
export function TrendChart({ rows }: { rows: ChartRow[] }) {
  if (rows.every((r) => r.count === 0)) return <ChartEmpty />;
  return (
    <EvilAreaChart
      config={config}
      data={rows.map((r) => ({ ...r }))}
      curveType="monotone"
      className="aspect-auto h-[200px]"
      chartProps={{ margin: { top: 8, left: 8, right: 8 } }}
    >
      <EvilAreaChart.Grid />
      <EvilAreaChart.XAxis dataKey="label" tickMargin={10} minTickGap={24} />
      <EvilAreaChart.Tooltip />
      <EvilAreaChart.Area dataKey="count">
        <EvilAreaChart.ActiveDot />
      </EvilAreaChart.Area>
    </EvilAreaChart>
  );
}
