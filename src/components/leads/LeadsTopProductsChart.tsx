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
              source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA (analyze-lead) é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads com service_desired preenchido."
              calculation="Conta os leads por service_desired, ordena do maior para o menor e mantém apenas os 5 produtos com mais leads."
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
