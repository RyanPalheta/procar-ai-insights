import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface LeadsTimelineChartProps {
  data: Array<{ date: string; count: number }>;
}

const chartConfig = {
  count: {
    label: "Leads",
    color: "hsl(var(--primary))",
  },
};

export function LeadsTimelineChart({ data }: LeadsTimelineChartProps) {
  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Leads Novos por Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
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
                  allowDecimals={false}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#leadsGradient)"
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))", r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        )}
      </CardContent>
    </Card>
  );
}
