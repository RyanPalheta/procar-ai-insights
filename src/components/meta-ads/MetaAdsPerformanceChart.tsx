import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { MousePointerClick } from "lucide-react";
import type { MetaAdsDailyData } from "@/types/meta-ads";
import { format, parseISO } from "date-fns";

interface MetaAdsPerformanceChartProps {
  data: MetaAdsDailyData[];
}

const chartConfig = {
  impressions: {
    label: "Impressoes",
    color: "hsl(var(--primary))",
  },
  clicks: {
    label: "Cliques",
    color: "hsl(var(--success))",
  },
};

export function MetaAdsPerformanceChart({ data }: MetaAdsPerformanceChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "dd/MM"),
  }));

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" />
            Impressoes & Cliques
            <ChartInfoTooltip
              description="Mostra, dia a dia, quantas vezes os anuncios apareceram (impressoes) e quantos cliques receberam. No grafico: embaixo voce ve o dia (dia/mes), a linha de baixo e quantas vezes apareceu e a linha verde e quantos cliques teve."
              source="os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado."
              calculation="cada ponto mostra o total de vezes que o anuncio apareceu e o total de cliques daquele dia, somados por dia."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formatted.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={8}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="impressions"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="clicks"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ fill: "hsl(var(--success))", r: 4 }}
                  />
                </LineChart>
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
