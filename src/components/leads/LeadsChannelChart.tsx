import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
  closedData: { name: string; value: number; conversion: number }[];
  mode: "all" | "closed";
  onModeChange: (mode: "all" | "closed") => void;
}

// Cores de marca dos canais — exceção legítima à paleta do tema
const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "#25D366",
  "Facebook": "#1877F2",
  "Instagram": "#E4405F",
  "N/A": "hsl(var(--chart-4))",
};

const getChannelColor = (channelName: string): string =>
  CHANNEL_COLORS[channelName] || "hsl(var(--chart-4))";

const chartConfig = {
  value: { label: "Leads" },
};

export function LeadsChannelChart({ data, closedData, mode, onModeChange }: LeadsChannelChartProps) {
  const displayData = mode === "all" ? data : closedData;
  const total = displayData.reduce((sum, d) => sum + d.value, 0);

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            {mode === "all" ? "Leads por Canal" : "Vendas Fechadas por Canal"}
            <ChartInfoTooltip
              description={
                mode === "all"
                  ? "Mostra de onde vieram seus clientes (WhatsApp, Facebook ou Instagram); cada fatia mostra quantos clientes e a porcentagem do total."
                  : "Mostra apenas as vendas fechadas separadas por onde o cliente veio; cada fatia mostra quantas vendas e a taxa de conversão daquele canal."
              }
              source={
                mode === "all"
                  ? "conta so os clientes que chegaram por conversa de WhatsApp/chat. Por isso o numero e menor que o total no Kommo. Aqui: todos os clientes do periodo, separados pelo canal de onde vieram."
                  : "conta so os clientes que chegaram por conversa de WhatsApp/chat. Por isso o numero e menor que o total no Kommo. Aqui: so os clientes marcados como venda fechada (ganha), separados pelo canal de onde vieram."
              }
              calculation={
                mode === "all"
                  ? "conta quantos clientes vieram de cada canal e calcula a fatia como os clientes do canal divididos pelo total de clientes, vezes 100."
                  : "para cada canal: o numero de vendas fechadas naquele canal; a conversao e as vendas fechadas do canal divididas pelo total de clientes do canal, vezes 100."
              }
            />
          </CardTitle>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as "all" | "closed")}
            size="sm"
          >
            <ToggleGroupItem value="all" className="text-xs px-3">Todos</ToggleGroupItem>
            <ToggleGroupItem value="closed" className="text-xs px-3">Vendas</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {total > 0 ? (
            <>
              {/* Donut com rótulo central */}
              <div className="relative">
                <ChartContainer config={chartConfig} className="h-[180px] w-full aspect-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={displayData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="70%"
                        outerRadius="95%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {displayData.map((entry) => (
                          <Cell key={entry.name} fill={getChannelColor(entry.name)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-extrabold tabular-nums leading-none">
                      {total.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      {mode === "all" ? "leads" : "vendas"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legenda padrão: dot + nome + valor + % */}
              <div className="mt-4 space-y-2">
                {displayData.map((entry) => {
                  const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-[3px]"
                          style={{ backgroundColor: getChannelColor(entry.name) }}
                        />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-bold">{entry.value}</span>
                        <span className="text-muted-foreground text-xs w-16 text-right">
                          {mode === "closed" && "conversion" in entry
                            ? `${(entry as { conversion: number }).conversion.toFixed(0)}% conv.`
                            : `${percentage.toFixed(0)}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
