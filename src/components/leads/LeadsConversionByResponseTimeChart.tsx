import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from "recharts";
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

// Colors based on performance relative to average
const getBarColor = (rate: number, avgRate: number) => {
  if (rate > avgRate * 1.1) return "hsl(142, 76%, 36%)"; // green - above average
  if (rate > avgRate * 0.9) return "hsl(48, 96%, 53%)"; // yellow - near average
  return "hsl(0, 72%, 51%)"; // red - below average
};

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

  // Calculate average conversion rate
  const avgRate = data && data.length > 0
    ? data.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.length
    : 0;

  // Find best and worst brackets
  const bestBracket = data?.reduce((best, current) => 
    (current.conversion_rate || 0) > (best?.conversion_rate || 0) ? current : best
  , data[0]);

  const worstBracket = data?.reduce((worst, current) => 
    (current.conversion_rate || 0) < (worst?.conversion_rate || 0) ? current : worst
  , data[0]);

  // Calculate multiplier (how many times better is best vs worst)
  const multiplier = bestBracket && worstBracket && worstBracket.conversion_rate > 0
    ? (bestBracket.conversion_rate / worstBracket.conversion_rate).toFixed(1)
    : null;

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
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Conversão por Tempo de Resposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart 
              data={data} 
              margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
              barCategoryGap="20%"
            >
              <XAxis 
                dataKey="time_bracket" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
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
                  const d = payload[0].payload as ConversionByResponseTimeData;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.time_bracket}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {d.converted_leads} convertidos de {d.total_leads} leads
                      </p>
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
