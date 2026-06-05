import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { DonutChart } from "@tremor/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
  closedData: { name: string; value: number; conversion: number }[];
  mode: "all" | "closed";
  onModeChange: (mode: "all" | "closed") => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "emerald",
  "Facebook": "blue",
  "Instagram": "pink",
  "N/A": "gray",
};

const getChannelTremorColor = (channelName: string): string => {
  return CHANNEL_COLORS[channelName] || "gray";
};

const CHANNEL_DOT_COLORS: Record<string, string> = {
  "WhatsApp": "#25D366",
  "Facebook": "#1877F2",
  "Instagram": "#E4405F",
  "N/A": "#9ca3af",
};

export function LeadsChannelChart({ data, closedData, mode, onModeChange }: LeadsChannelChartProps) {
  const displayData = mode === "all" ? data : closedData;
  const colors = displayData.map(d => getChannelTremorColor(d.name));

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            {mode === "all" ? "Leads por Canal" : "Vendas Fechadas por Canal"}
            <ChartInfoTooltip
              description={
                mode === "all"
                  ? "Distribui o volume de leads por canal de origem (WhatsApp, Facebook, Instagram); cada fatia mostra a contagem e o % do total."
                  : "Distribui apenas as vendas ganhas por canal de origem; cada fatia mostra a contagem de fechamentos e a taxa de conversão do canal."
              }
              source={
                mode === "all"
                  ? "Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera todos os leads do filtro, agrupando o campo channel (normalizado)."
                  : "Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads com sales_status 'ganha' e channel diferente de 'N/A'."
              }
              calculation={
                mode === "all"
                  ? "Conta os leads por canal (channel normalizado) e calcula a fatia como contagem do canal ÷ total de leads × 100."
                  : "Para cada canal: vendas ganhas no canal como valor; conversão = ganhas do canal ÷ total de leads do canal × 100."
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
          {/* Custom legend */}
          <div className="flex justify-center gap-6 mb-4">
            {displayData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHANNEL_DOT_COLORS[entry.name] || "#9ca3af" }}
                />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{entry.name}</span>
                  <span className="text-sm font-semibold">{entry.value}</span>
                  {mode === "closed" && "conversion" in entry && (
                    <span className="text-xs text-muted-foreground">
                      {(entry as { conversion: number }).conversion.toFixed(0)}% conv.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Donut Chart */}
          <DonutChart
            data={displayData}
            category="value"
            index="name"
            colors={colors}
            showAnimation={true}
            showTooltip={true}
            className="h-[180px]"
          />
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
