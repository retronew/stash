import { EvilPieChart } from "#components/evilcharts/charts/recharts-pie-chart";
import { ChartEmpty, type ChartRow } from "#components/stats/StatCharts";
import { chartColor } from "#lib/chartColor";
import { m } from "#lib/i18n";

const TOP = 5;
const COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"];
const OTHER_COLOR = "var(--muted-foreground)";

/** Share of messages per category: the top few, then everything else as "Other". */
export function CategoryDonutChart({ rows }: { rows: ChartRow[] }) {
  if (rows.length === 0) return <ChartEmpty />;
  const rest = rows.slice(TOP).reduce((sum, r) => sum + r.count, 0);
  // Sector names are synthetic keys: category names aren't safe CSS variable names.
  const data = rows.slice(0, TOP).map((r, i) => ({ key: `c${i}`, label: r.label, count: r.count, color: COLORS[i] }));
  if (rest > 0) data.push({ key: "other", label: m.stats_category_other(), count: rest, color: OTHER_COLOR });

  const config = Object.fromEntries(data.map((r) => [r.key, { label: r.label, ...chartColor(r.color) }]));
  return (
    <EvilPieChart config={config} data={data} dataKey="count" nameKey="key" className="mx-auto aspect-square max-h-[320px]">
      <EvilPieChart.Pie innerRadius="55%" paddingAngle={2} cornerRadius={4} />
      <EvilPieChart.Tooltip />
      <EvilPieChart.Legend />
    </EvilPieChart>
  );
}
