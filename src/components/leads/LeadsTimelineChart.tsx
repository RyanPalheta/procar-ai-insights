import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
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
            <ChartInfoTooltip
              description="Mostra como o número de clientes novos varia a cada dia. Na linha de baixo aparece cada dia do período e a linha mostra quantos clientes novos chegaram naquele dia."
              source="conta os clientes novos que chegaram no período selecionado, respeitando os filtros de canal, situação e idioma que você ativou. A análise feita pela IA é gravada de volta no Kommo (não é uma leitura ao vivo do Kommo)."
              calculation="agrupamos os clientes pelo dia em que chegaram e contamos quantos foram em cada dia, criando um ponto por dia dentro do período escolhido."
            />
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
