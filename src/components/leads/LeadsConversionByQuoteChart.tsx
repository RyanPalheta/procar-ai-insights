import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, DollarSign } from "lucide-react";

interface ConversionByQuoteData {
  quote_bracket: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  avg_quote_value: number;
}

interface LeadsConversionByQuoteChartProps {
  periodDays: number | null;
}

export function LeadsConversionByQuoteChart({ periodDays }: LeadsConversionByQuoteChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversion-by-quote-bracket", periodDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversion_by_quote_bracket", {
        period_days: periodDays
      });
      if (error) throw error;
      return data as ConversionByQuoteData[];
    }
  });

  const avgRate = data && data.length > 0
    ? data.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.length
    : 0;

  const dataWithQuote = data?.filter(d => d.quote_bracket !== "Sem Cotação") || [];
  const dataWithoutQuote = data?.find(d => d.quote_bracket === "Sem Cotação");

  const bestBracket = dataWithQuote.length > 0
    ? dataWithQuote.reduce((best, current) =>
        (current.conversion_rate || 0) > (best?.conversion_rate || 0) ? current : best
      , dataWithQuote[0])
    : null;

  const withQuoteAvg = dataWithQuote.length > 0
    ? dataWithQuote.reduce((sum, d) => sum + (d.converted_leads || 0), 0) /
      dataWithQuote.reduce((sum, d) => sum + (d.total_leads || 0), 0) * 100
    : 0;
  const withoutQuoteRate = dataWithoutQuote?.conversion_rate || 0;
  const quoteMultiplier = withoutQuoteRate > 0
    ? (withQuoteAvg / withoutQuoteRate).toFixed(1)
    : null;

  // Transform data for multi-category coloring
  const chartData = data?.map(d => {
    const rate = d.conversion_rate || 0;
    const isAbove = rate > avgRate * 1.1;
    const isNear = !isAbove && rate > avgRate * 0.9;
    return {
      quote_bracket: d.quote_bracket,
      "Acima da média": isAbove ? rate : null,
      "Na média": isNear ? rate : null,
      "Abaixo da média": (!isAbove && !isNear) ? rate : null,
      // Keep original data for tooltip
      _total: d.total_leads,
      _converted: d.converted_leads,
      _rate: rate,
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
          {d._converted} convertidos de {d._total} leads
        </p>
        {d._avgQuote > 0 && (
          <p className="text-xs mt-1">
            Valor médio: R$ {d._avgQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
        <p className="font-semibold mt-1">Taxa: {d._rate?.toFixed(1)}%</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="34, 197, 94">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Conversão por Cotação
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
      <MagicBentoCard className="rounded-lg" glowColor="34, 197, 94">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Conversão por Cotação
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
    <MagicBentoCard className="rounded-lg" glowColor="34, 197, 94">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Conversão por Cotação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarChart
            data={chartData}
            index="quote_bracket"
            categories={["Acima da média", "Na média", "Abaixo da média"]}
            colors={["emerald", "yellow", "red"]}
            showLegend={false}
            showGridLines={false}
            yAxisWidth={40}
            valueFormatter={(v: number) => v != null ? `${v.toFixed(0)}%` : ""}
            customTooltip={customTooltip}
            className="h-[200px]"
          />

          {/* Insight Card */}
          {quoteMultiplier && parseFloat(quoteMultiplier) > 1 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Insight:</span>{" "}
                  Leads com cotação convertem{" "}
                  <span className="font-semibold text-green-600 dark:text-green-400">{quoteMultiplier}x mais</span>{" "}
                  que leads sem cotação
                  {bestBracket && (
                    <>. Melhor faixa:{" "}
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {bestBracket.quote_bracket}
                      </span>{" "}
                      ({bestBracket.conversion_rate?.toFixed(1)}%)
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {quoteMultiplier && parseFloat(quoteMultiplier) <= 1 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Observação:</span>{" "}
                  Leads sem cotação têm conversão similar ou superior aos com cotação.
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-muted-foreground">Acima da média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-400" />
              <span className="text-muted-foreground">Na média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-muted-foreground">Abaixo da média</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
