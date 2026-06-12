import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Lightbulb, Clock } from "lucide-react";

interface ConversionByResponseTimeData {
  time_bracket: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
}

interface LeadsConversionByResponseTimeChartProps {
  dateFrom: string | null;
  dateTo: string | null;
}

const TOOLTIP = {
  description:
    "Relaciona a rapidez do atendimento com a taxa de conversão; eixo X = faixas de tempo de resposta, barra = % de leads que viraram venda em cada faixa. A linha tracejada marca a média entre as faixas.",
  source:
    "cruza os clientes que chegaram por conversa de WhatsApp/chat com as mensagens trocadas no WhatsApp/Instagram/Facebook. Considera so os clientes que a IA ja analisou e que tiveram pelo menos 3 mensagens na mesma conversa. Como conta so conversas de chat, o numero e menor que o total no Kommo.",
  calculation:
    "o tempo de resposta é quantos minutos passaram entre a 1ª mensagem do cliente e a 1ª resposta do agente, agrupado em faixas (0-15, 15-30, 30-60, 60+ min). A taxa de cada faixa = clientes cujo ORÇAMENTO FOI PAGO na loja (ShopMonkey, ligado ao cliente pelo telefone, pago depois da chegada do lead) dividido pelo total de clientes da faixa, vezes 100.",
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

export function LeadsConversionByResponseTimeChart({ dateFrom, dateTo }: LeadsConversionByResponseTimeChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversion-by-response-time", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversion_by_response_time", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as ConversionByResponseTimeData[];
    }
  });

  const avgRate = data && data.length > 0
    ? data.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.length
    : 0;

  const bestBracket = data?.reduce((best, current) =>
    (current.conversion_rate || 0) > (best?.conversion_rate || 0) ? current : best
  , data[0]);

  const worstBracket = data?.reduce((worst, current) =>
    (current.conversion_rate || 0) < (worst?.conversion_rate || 0) ? current : worst
  , data[0]);

  const multiplier = bestBracket && worstBracket && worstBracket.conversion_rate > 0
    ? (bestBracket.conversion_rate / worstBracket.conversion_rate).toFixed(1)
    : null;

  const chartData = data?.map(d => {
    const rate = d.conversion_rate || 0;
    const isAbove = rate > avgRate * 1.1;
    const isNear = !isAbove && rate > avgRate * 0.9;
    const category: keyof typeof CATEGORY_COLORS = isAbove ? "above" : isNear ? "near" : "below";
    return {
      time_bracket: d.time_bracket,
      rate,
      category,
      _total: d.total_leads,
      _converted: d.converted_leads,
    };
  }) || [];

  const customTooltip = ({ payload, active }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium">{d.time_bracket}</p>
        <p className="text-muted-foreground text-xs mt-1">
          {d._converted} convertidos de {d._total} leads
        </p>
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
              <Clock className="h-5 w-5" />
              Conversão por Tempo de Resposta
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
              <Clock className="h-5 w-5" />
              Conversão por Tempo de Resposta
              <ChartInfoTooltip {...TOOLTIP} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              Sem dados suficientes para análise
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
            <Clock className="h-5 w-5" />
            Conversão por Tempo de Resposta
            <ChartInfoTooltip {...TOOLTIP} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartContainer config={chartConfig} className="h-[200px] w-full aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                <XAxis
                  dataKey="time_bracket"
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
                    <Cell key={entry.time_bracket} fill={CATEGORY_COLORS[entry.category]} />
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
          {bestBracket && multiplier && parseFloat(multiplier) > 1 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Insight:</span>{" "}
                  Leads respondidos em{" "}
                  <span className="font-semibold text-primary">{bestBracket.time_bracket}</span>{" "}
                  convertem{" "}
                  <span className="font-semibold text-primary">{multiplier}x mais</span>{" "}
                  que os respondidos após{" "}
                  <span className="text-muted-foreground">{worstBracket?.time_bracket}</span>
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
