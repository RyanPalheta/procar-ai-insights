import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart } from "@tremor/react";

interface LeadsTopProductsChartProps {
  data: { name: string; value: number }[];
}

export function LeadsTopProductsChart({ data }: LeadsTopProductsChartProps) {
  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle>Top 5 Produtos Desejados</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={data}
            index="name"
            categories={["value"]}
            colors={["violet"]}
            showLegend={false}
            showGridLines={true}
            yAxisWidth={40}
            className="h-[280px]"
          />
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
