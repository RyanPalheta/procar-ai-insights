import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { DollarSign } from "lucide-react";
import type { GoogleAdsDailyData } from "@/types/google-ads";
import { format, parseISO } from "date-fns";

interface GoogleAdsSpendChartProps {
  data: GoogleAdsDailyData[];
}

const chartConfig = {
  spend: {
    label: "Gasto ($)",
    color: "hsl(var(--chart-3))",
  },
};

export function GoogleAdsSpendChart({ data }: GoogleAdsSpendChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "dd/MM"),
  }));

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-warning" />
            Gasto Diario
            <ChartInfoTooltip
              description="Mostra a evolucao do investimento diario em anuncios do Google Ads; Eixo X = dia (dd/MM) e Eixo Y = valor gasto na moeda da conta ($)."
              source="os numeros vem direto do Google Ads, no periodo selecionado. Nao passam pela Kommo."
              calculation="cada ponto mostra o total gasto naquele dia, sem media e sem somar com os dias anteriores."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formatted.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gadsSpendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={(v) => `$${v}`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    fill="url(#gadsSpendGradient)"
                    dot={false}
                    activeDot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, stroke: "hsl(var(--card))", r: 5 }}
                  />
                </AreaChart>
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
