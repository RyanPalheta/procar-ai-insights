import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Filter } from "lucide-react";
import type { MetaAdsKPIs } from "@/types/meta-ads";

interface MetaAdsFunnelChartProps {
  data: MetaAdsKPIs;
}

const chartConfig = {
  value: {
    label: "Quantidade",
    color: "hsl(var(--primary))",
  },
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
];

export function MetaAdsFunnelChart({ data }: MetaAdsFunnelChartProps) {
  const funnelData = [
    { name: "Impressoes", value: data.impressions },
    { name: "Cliques", value: data.clicks },
    { name: "Leads", value: data.leads },
    { name: "Compras", value: data.purchases },
  ];

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Funil de Conversao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13, fontWeight: 500 }}
                  width={75}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                  {funnelData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
