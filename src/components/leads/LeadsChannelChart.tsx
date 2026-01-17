import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
  closedData: { name: string; value: number; conversion: number }[];
  mode: "all" | "closed";
  onModeChange: (mode: "all" | "closed") => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "#25D366",
  "Facebook": "#1877F2",
  "Instagram": "#E4405F",
  "N/A": "hsl(var(--muted))",
};

const getChannelColor = (channelName: string): string => {
  return CHANNEL_COLORS[channelName] || "hsl(var(--muted))";
};

export function LeadsChannelChart({ data, closedData, mode, onModeChange }: LeadsChannelChartProps) {
  const displayData = mode === "all" ? data : closedData;
  
  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>{mode === "all" ? "Leads por Canal" : "Vendas Fechadas por Canal"}</CardTitle>
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
          {/* Legenda customizada no topo */}
          <div className="flex justify-center gap-6 mb-4">
            {displayData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getChannelColor(entry.name) }}
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
          
          {/* Gráfico semi-circular */}
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={displayData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {displayData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getChannelColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
