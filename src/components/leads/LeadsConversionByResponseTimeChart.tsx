import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Clock } from "lucide-react";

interface ConversionByResponseTimeData {
  time_bracket: string;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
}

interface LeadsConversionByResponseTimeChartProps {
  periodDays: number | null;
}

export function LeadsConversionByResponseTimeChart({ periodDays }: LeadsConversionByResponseTimeChartProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversion-by-response-time", periodDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversion_by_response_time", {
        period_days: periodDays
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

  // Transform data for multi-category coloring
  const chartData = data?.map(d => {
    const rate = d.conversion_rate || 0;
    const isAbove = rate > avgRate * 1.1;
    const isNear = !isAbove && rate > avgRate * 0.9;
    return {
      time_bracket: d.time_bracket,
      "Acima da média": isAbove ? rate : null,
      "Na média": isNear ? rate : null,
      "Abaixo da média": (!isAbove && !isNear) ? rate : null,
      _total: d.total_leads,
      _converted: d.converted_leads,
      _rate: rate,
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
        <p className="font-semibold mt-1">Taxa: {d._rate?.toFixed(1)}%</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Conversão por Tempo de Resposta
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
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Conversão por Tempo de Resposta
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
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Conversão por Tempo de Resposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarChart
            data={chartData}
            index="time_bracket"
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
