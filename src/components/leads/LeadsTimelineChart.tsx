import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LeadsTimelineChartProps {
  data: Array<{ date: string; count: number }>;
  period: "7" | "30" | "90";
  onPeriodChange: (period: "7" | "30" | "90") => void;
}

const chartConfig = {
  count: {
    label: "Leads",
    color: "#8b5cf6",
  },
};

export function LeadsTimelineChart({ data, period, onPeriodChange }: LeadsTimelineChartProps) {
  return (
    <MagicBentoCard className="rounded-lg col-span-full" glowColor="59, 130, 246">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            Leads Novos por Período
          </CardTitle>
          <ToggleGroup 
            type="single" 
            value={period} 
            onValueChange={(value) => value && onPeriodChange(value as "7" | "30" | "90")}
            size="sm"
          >
            <ToggleGroupItem value="7" className="text-xs px-3 data-[state=on]:bg-purple-600 data-[state=on]:text-white">7 dias</ToggleGroupItem>
            <ToggleGroupItem value="30" className="text-xs px-3 data-[state=on]:bg-purple-600 data-[state=on]:text-white">30 dias</ToggleGroupItem>
            <ToggleGroupItem value="90" className="text-xs px-3 data-[state=on]:bg-purple-600 data-[state=on]:text-white">90 dias</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickMargin={8}
                    allowDecimals={false}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#leadsGradient)"
                    dot={{ fill: "#8b5cf6", strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: "#8b5cf6", strokeWidth: 2, stroke: "#060010", r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-white/60">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
