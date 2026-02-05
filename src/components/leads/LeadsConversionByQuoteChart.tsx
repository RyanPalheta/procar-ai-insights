import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from "recharts";
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

// Colors based on performance relative to average
const getBarColor = (rate: number, avgRate: number) => {
  if (rate > avgRate * 1.1) return "hsl(142, 76%, 36%)"; // green - above average
  if (rate > avgRate * 0.9) return "hsl(48, 96%, 53%)"; // yellow - near average
  return "hsl(0, 72%, 51%)"; // red - below average
};

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

  // Calculate average conversion rate
  const avgRate = data && data.length > 0
    ? data.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.length
    : 0;

  // Find best bracket (excluding "Sem Cotação" for best performance comparison)
  const dataWithQuote = data?.filter(d => d.quote_bracket !== "Sem Cotação") || [];
  const dataWithoutQuote = data?.find(d => d.quote_bracket === "Sem Cotação");

  const bestBracket = dataWithQuote.length > 0
    ? dataWithQuote.reduce((best, current) => 
        (current.conversion_rate || 0) > (best?.conversion_rate || 0) ? current : best
      , dataWithQuote[0])
    : null;

  // Calculate comparison between with quote vs without quote
  const withQuoteAvg = dataWithQuote.length > 0
    ? dataWithQuote.reduce((sum, d) => sum + (d.converted_leads || 0), 0) / 
      dataWithQuote.reduce((sum, d) => sum + (d.total_leads || 0), 0) * 100
    : 0;

  const withoutQuoteRate = dataWithoutQuote?.conversion_rate || 0;
  
  // Multiplier: how much better is "with quote" vs "without quote"
  const quoteMultiplier = withoutQuoteRate > 0 
    ? (withQuoteAvg / withoutQuoteRate).toFixed(1) 
    : null;

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
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Conversão por Cotação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart 
              data={data} 
              margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
              barCategoryGap="15%"
            >
              <XAxis 
                dataKey="quote_bracket" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ConversionByQuoteData;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.quote_bracket}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {d.converted_leads} convertidos de {d.total_leads} leads
                      </p>
                      {d.avg_quote_value && d.avg_quote_value > 0 && (
                        <p className="text-xs mt-1">
                          Valor médio: R$ {d.avg_quote_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      <p className="font-semibold text-sm mt-1">
                        Taxa: {d.conversion_rate?.toFixed(1)}%
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="conversion_rate" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.conversion_rate || 0, avgRate)} 
                  />
                ))}
                <LabelList 
                  dataKey="conversion_rate" 
                  position="top" 
                  formatter={(value: number) => `${value?.toFixed(0)}%`}
                  style={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Insight Card */}
          {quoteMultiplier && parseFloat(quoteMultiplier) > 1 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Insight:</span>{" "}
                  Leads com cotação apresentada convertem{" "}
                  <span className="font-semibold text-green-600 dark:text-green-400">{quoteMultiplier}x mais</span>{" "}
                  que leads sem cotação
                  {bestBracket && (
                    <>
                      . Melhor faixa:{" "}
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
                  Verifique se as cotações estão sendo apresentadas corretamente.
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
              <span className="text-muted-foreground">Acima da média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(48, 96%, 53%)" }} />
              <span className="text-muted-foreground">Na média</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />
              <span className="text-muted-foreground">Abaixo da média</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
