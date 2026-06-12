import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { MousePointerClick } from "lucide-react";
import type { GoogleAdsDailyData } from "@/types/google-ads";
import { format, parseISO } from "date-fns";

interface GoogleAdsPerformanceChartProps {
  data: GoogleAdsDailyData[];
}

const chartConfig = {
  clicks: {
    label: "Cliques",
    color: "hsl(var(--chart-3))",
  },
  conversions: {
    label: "Conversoes",
    color: "hsl(var(--success))",
  },
};

export function GoogleAdsPerformanceChart({ data }: GoogleAdsPerformanceChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "dd/MM"),
  }));

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-warning" />
            Cliques e Conversoes
            <ChartInfoTooltip
              description="Compara cliques e conversoes diarios do Google Ads; Eixo X = dia (dd/MM), barra amarela = cliques e barra verde = conversoes no mesmo dia."
              source="os numeros vem direto do Google Ads, no periodo selecionado."
              calculation="cada par de barras mostra o total de cliques e de conversoes daquele dia, juntando tudo por data."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formatted.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="clicks"
                    fill="hsl(var(--chart-3))"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Bar
                    dataKey="conversions"
                    fill="hsl(var(--success))"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados disponiveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
