import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "#components/ui/chart";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { m } from "#lib/i18n";

// PickIt's stats charts: a card with a title, and horizontal bars (a ranked
// list) or columns (over time).

const config = { count: { label: m.stats_count(), color: "var(--chart-2)" } } satisfies ChartConfig;

export interface ChartRow {
  label: string;
  count: number;
}

function ChartEmpty() {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>{m.stats_empty()}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export function StatCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter className="text-muted-foreground text-sm">{footer}</CardFooter>}
    </Card>
  );
}

const truncate = (label: string, max = 10) => (label.length > max ? `${label.slice(0, max)}…` : label);

/** Horizontal bars, largest first: categories, bots, conversations. */
export function BarList({ rows }: { rows: ChartRow[] }) {
  if (rows.length === 0) return <ChartEmpty />;
  const data = rows.map((r) => ({ ...r, label: truncate(r.label) }));
  return (
    <ChartContainer config={config} className="w-full" style={{ aspectRatio: "auto", height: data.length * 26 + 8 }}>
      <BarChart accessibilityLayer data={data} layout="vertical" barSize={12} margin={{ left: -8 }}>
        <XAxis type="number" dataKey="count" hide />
        <YAxis dataKey="label" type="category" tickLine={false} tickMargin={10} axisLine={false} width={116} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={5} />
      </BarChart>
    </ChartContainer>
  );
}

/** Columns over time: days or months. */
export function ColumnChart({ rows }: { rows: ChartRow[] }) {
  if (rows.every((r) => r.count === 0)) return <ChartEmpty />;
  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <BarChart accessibilityLayer data={rows} maxBarSize={40} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
