import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { BarChart } from "@tremor/react";

interface LeadsTopProductsChartProps {
  data: { name: string; value: number }[];
}

export function LeadsTopProductsChart({ data }: LeadsTopProductsChartProps) {
  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Top 5 Produtos Desejados
            <ChartInfoTooltip
              description="Ranqueia os 5 serviços/produtos mais desejados; eixo X = produto, barra = quantidade de leads que pediram cada produto."
              source="conta os clientes que disseram qual serviço ou produto querem; só entram clientes que informaram o produto desejado. A análise feita pela IA é depois devolvida ao Kommo (não é uma leitura ao vivo do Kommo)."
              calculation="conta quantos clientes pediram cada produto, ordena do mais pedido para o menos pedido e mostra só os 5 produtos mais pedidos."
            />
          </CardTitle>
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
