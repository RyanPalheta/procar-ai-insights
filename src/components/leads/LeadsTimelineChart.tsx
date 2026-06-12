import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Area, AreaChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface LeadsTimelineChartProps {
  data: Array<{ date: string; count: number }>;
}

const chartConfig = {
  count: {
    label: "Leads novos",
    color: "hsl(var(--chart-1))",
  },
};

export function LeadsTimelineChart({ data }: LeadsTimelineChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const peak = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 0;
  // ~7 rótulos no eixo X independente do tamanho do período
  const tickInterval = Math.max(0, Math.ceil(data.length / 7) - 1);
  // valor sempre visível em cada ponto; em períodos longos pula alguns
  // rótulos (máx. ~25) para não sobrepor — o tooltip continua com todos
  const labelStep = Math.max(1, Math.ceil(data.length / 25));

  const renderPointLabel = (props: { x?: number | string; y?: number | string; value?: number | string; index?: number }) => {
    const { x, y, value, index } = props;
    if (index === undefined || index % labelStep !== 0) return null;
    return (
      <text
        x={Number(x)}
        y={Number(y) - 9}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        style={{ fontVariantNumeric: "tabular-nums" }}
        fill="hsl(var(--foreground))"
      >
        {value}
      </text>
    );
  };

  return (
    <MagicBentoCard className="rounded-lg col-span-full" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Leads Novos por Período
              <ChartInfoTooltip
                description="Mostra como o número de clientes novos varia a cada dia. Na linha de baixo aparece cada dia do período e a linha mostra quantos clientes novos chegaram naquele dia. A linha tracejada marca a média diária do período."
                source="conta os clientes novos que chegaram no período selecionado, respeitando os filtros de canal, situação e idioma que você ativou. A análise feita pela IA é gravada de volta no Kommo (não é uma leitura ao vivo do Kommo)."
                calculation="agrupamos os clientes pelo dia em que chegaram e contamos quantos foram em cada dia, criando um ponto por dia dentro do período escolhido."
              />
            </CardTitle>
            {data.length > 0 && (
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-lg font-bold leading-none tabular-nums">{total.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">total</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-none tabular-nums">{avg.toFixed(1).replace(".", ",")}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">média/dia</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-none tabular-nums">{peak}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">pico</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadsTimelineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    interval={tickInterval}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={36}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickMargin={6}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <ReferenceLine
                    y={avg}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeWidth={1.2}
                    label={{
                      value: `média ${avg.toFixed(1).replace(".", ",")}`,
                      position: "insideTopRight",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    fill="url(#leadsTimelineGradient)"
                    dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 0, r: 2.5 }}
                    activeDot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, stroke: "hsl(var(--card))", r: 5 }}
                  >
                    <LabelList dataKey="count" content={renderPointLabel} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
