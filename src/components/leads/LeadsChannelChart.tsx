import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
  closedData: { name: string; value: number; conversion: number }[];
  mode: "all" | "closed";
  onModeChange: (mode: "all" | "closed") => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "hsl(142, 71%, 45%)", // Verde
  "Facebook": "hsl(217, 91%, 60%)", // Azul
  "Instagram": "hsl(330, 81%, 56%)", // Rosa
};

const getChannelColor = (channelName: string): string => {
  return CHANNEL_COLORS[channelName] || "hsl(var(--muted))";
};

export function LeadsChannelChart({ data, closedData, mode, onModeChange }: LeadsChannelChartProps) {
  const displayData = mode === "all" ? data : closedData;
  
  const renderLabel = ({ name, percent, conversion }: { name: string; percent: number; conversion?: number }) => {
    if (mode === "closed" && conversion !== undefined) {
      return `${name}: ${(percent * 100).toFixed(0)}% (${conversion.toFixed(0)}% conv.)`;
    }
    return `${name}: ${(percent * 100).toFixed(0)}%`;
  };
  
  return (
    <Card>
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
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getChannelColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
