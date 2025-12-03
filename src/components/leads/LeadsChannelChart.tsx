import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
  closedData: { name: string; value: number; conversion: number }[];
  mode: "all" | "closed";
  onModeChange: (mode: "all" | "closed") => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "hsl(142, 71%, 45%)",
  "Facebook": "hsl(217, 91%, 60%)",
  "Instagram": "hsl(330, 81%, 56%)",
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
    <MagicBentoCard className="rounded-lg" glowColor="132, 0, 255">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white">{mode === "all" ? "Leads por Canal" : "Vendas Fechadas por Canal"}</CardTitle>
          <ToggleGroup 
            type="single" 
            value={mode} 
            onValueChange={(value) => value && onModeChange(value as "all" | "closed")}
            size="sm"
          >
            <ToggleGroupItem value="all" className="text-xs px-3 data-[state=on]:bg-purple-600 data-[state=on]:text-white">Todos</ToggleGroupItem>
            <ToggleGroupItem value="closed" className="text-xs px-3 data-[state=on]:bg-purple-600 data-[state=on]:text-white">Vendas</ToggleGroupItem>
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
              <Tooltip contentStyle={{ backgroundColor: "#1a1025", border: "1px solid #392e4e", color: "white" }} />
              <Legend wrapperStyle={{ color: "white" }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
