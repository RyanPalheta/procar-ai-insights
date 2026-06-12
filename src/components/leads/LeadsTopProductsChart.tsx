import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Package } from "lucide-react";

interface LeadsTopProductsChartProps {
  data: { name: string; value: number }[];
}

const chartConfig = {
  value: {
    label: "Leads",
    color: "hsl(var(--chart-1))",
  },
};

// Degradê da marca: o 1º colocado é o vermelho cheio, os demais vão clareando
const BAR_OPACITIES = [1, 0.85, 0.7, 0.55, 0.4];

export function LeadsTopProductsChart({ data }: LeadsTopProductsChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Top 5 Produtos Desejados
            <ChartInfoTooltip
              description="Ranqueia os 5 serviços/produtos mais desejados; cada barra mostra a quantidade de leads que pediram o produto."
              source="conta os clientes que disseram qual serviço ou produto querem; só entram clientes que informaram o produto desejado. A análise feita pela IA é depois devolvida ao Kommo (não é uma leitura ao vivo do Kommo)."
              calculation="conta quantos clientes pediram cada produto, ordena do mais pedido para o menos pedido e mostra só os 5 produtos mais pedidos."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sorted}
                  layout="vertical"
                  margin={{ top: 4, right: 36, left: 0, bottom: 4 }}
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={110}
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={22}>
                    {sorted.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill="hsl(var(--chart-1))"
                        fillOpacity={BAR_OPACITIES[index] ?? 0.4}
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      className="fill-muted-foreground"
                      style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
