import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { m } from "#lib/i18n";

// PickIt's stats cards: a title, an optional hint and footer, and a chart
// (EvilCharts: TrendChart, RankBarChart, CategoryDonutChart).

export interface ChartRow {
  label: string;
  count: number;
}

export function ChartEmpty() {
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
