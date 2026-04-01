import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { AreaChart } from "@tremor/react";
import { TrendingUp } from "lucide-react";

interface LeadsTimelineChartProps {
  data: Array<{ date: string; count: number }>;
}

export function LeadsTimelineChart({ data }: LeadsTimelineChartProps) {
  return (
    <MagicBentoCard className="rounded-lg col-span-full" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads Novos por Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <AreaChart
              data={data}
              index="date"
              categories={["count"]}
              colors={["blue"]}
              showLegend={false}
              showGradient={true}
              showAnimation={true}
              yAxisWidth={40}
              curveType="monotone"
              className="h-[200px]"
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
