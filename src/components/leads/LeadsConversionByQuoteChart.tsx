import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/utils";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Lightbulb, DollarSign } from "lucide-react";

interface ConversionByQuoteData {
  quote_bracket: string;
  total_leads: number;      // orçamentos gerados na faixa
  converted_leads: number;  // desses, quantos foram pagos
  conversion_rate: number;
  avg_quote_value: number;
}

interface LeadsConversionByQuoteChartProps {
  dateFrom: string | null;
  dateTo: string | null;
}

const TOOLTIP = {
  description:
    "Mostra, por faixa de valor do PRIMEIRO orçamento que o lead recebeu, quantos leads viraram venda paga; eixo X = faixas em USD, barra = % de leads convertidos. A linha tracejada marca a média entre as faixas. Mesma definição de conversão do gráfico de Tempo de Resposta.",
  source:
    "cruza os leads do painel com os orçamentos do ShopMonkey, ligados pelo telefone do cliente. Só conta orçamentos gerados DEPOIS da chegada do lead (sem arquivados e sem valor zero) — orçamentos de clientes walk-in que não vieram como lead ficam de fora.",
  calculation:
    "para cada lead do período com orçamento no ShopMonkey, pega o primeiro orçamento após a chegada e agrupa pela faixa de valor: $0-500, $500-1000, $1000-2000, $2000+. A taxa da faixa = leads com venda PAGA na loja (ShopMonkey, paga depois da chegada do lead) divididos pelos leads da faixa, vezes 100.",
};

// Semântica vs. média: verde acima, âmbar na média, vermelho abaixo
const CATEGORY_COLORS = {
  above: "hsl(var(--success))",
  near: "hsl(var(--warning))",
  below: "hsl(var(--destructive-foreground))",
} as const;

const chartConfig = {
  rate: { label: "Taxa de conversão" },
};

export function LeadsConversionByQuoteChart({ dateFrom, dateTo }: LeadsConversionByQuoteChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversion-by-quote-bracket", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversion_by_quote_bracket", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as ConversionByQuoteData[];
    }
  });

  const avgRate = data && data.length > 0
    ? data.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.length
    : 0;

  const totalGerados = data?.reduce((sum, d) => sum + (d.total_leads || 0), 0) || 0;
  const totalPagos = data?.reduce((sum, d) => sum + (d.converted_leads || 0), 0) || 0;
  const overallRate = totalGerados > 0 ? (totalPagos / totalGerados) * 100 : 0;

  const bestBracket = data && data.length > 0
    ? data.reduce((best, current) =>
        (current.conversion_rate || 0) > (best?.conversion_rate || 0) ? current : best
      , data[0])
    : null;

  const chartData = data?.map(d => {
    const rate = d.conversion_rate || 0;
    const isAbove = rate > avgRate * 1.1;
    const isNear = !isAbove && rate > avgRate * 0.9;
    const category: keyof typeof CATEGORY_COLORS = isAbove ? "above" : isNear ? "near" : "below";
    return {
      quote_bracket: d.quote_bracket,
      rate,
      category,
      _total: d.total_leads,
      _converted: d.converted_leads,
      _avgQuote: d.avg_quote_value,
    };
  }) || [];

  const customTooltip = ({ payload, active }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium">{d.quote_bracket}</p>
        <p className="text-muted-foreground text-xs mt-1">
          {d._converted} convertidos de {d._total} leads com orçamento
        </p>
        {d._avgQuote > 0 && (
          <p className="text-xs mt-1">
            Valor médio: {formatUSD(d._avgQuote)}
          </p>
        )}
        <p className="font-semibold mt-1 tabular-nums">Taxa: {d.rate?.toFixed(1)}%</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Conversão por Cotação
              <ChartInfoTooltip {...TOOLTIP} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </MagicBentoCard>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Conversão por Cotação
              <ChartInfoTooltip {...TOOLTIP} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Sem orçamentos no período
            </div>
          </CardContent>
        </Card>
      </MagicBentoCard>
    );
  }

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Conversão por Cotação
            <ChartInfoTooltip {...TOOLTIP} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartContainer config={chartConfig} className="h-[200px] w-full aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                <XAxis
                  dataKey="quote_bracket"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip content={customTooltip} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <ReferenceLine
                  y={avgRate}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  strokeWidth={1.2}
                  label={{
                    value: `média ${avgRate.toFixed(0)}%`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {chartData.map((entry) => (
                    <Cell key={entry.quote_bracket} fill={CATEGORY_COLORS[entry.category]} />
                  ))}
                  <LabelList
                    dataKey="rate"
                    position="top"
                    className="fill-muted-foreground"
                    style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                    formatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Insight Card */}
          {totalGerados > 0 && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Insight:</span>{" "}
                  <span className="font-semibold text-success">
                    {totalPagos} de {totalGerados}
                  </span>{" "}
                  leads que receberam orçamento converteram em venda paga ({overallRate.toFixed(1)}%)
                  {bestBracket && (bestBracket.conversion_rate || 0) > 0 && (
                    <>. Faixa que mais converte:{" "}
                      <span className="font-semibold text-success">
                        {bestBracket.quote_bracket}
                      </span>{" "}
                      ({bestBracket.conversion_rate?.toFixed(1)}%)
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CATEGORY_COLORS.above }} />
              <span className="text-muted-foreground">Acima da média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CATEGORY_COLORS.near }} />
              <span className="text-muted-foreground">Na média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: CATEGORY_COLORS.below }} />
              <span className="text-muted-foreground">Abaixo da média</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
