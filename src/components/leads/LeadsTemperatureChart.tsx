import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Thermometer } from "lucide-react";

interface LeadsTemperatureChartProps {
  data: { name: string; value: number }[];
}

const TEMPERATURE_COLORS: Record<string, string> = {
  "Quente": "#f97316", // orange-500
  "Morno": "#eab308",  // yellow-500
  "Frio": "#3b82f6"    // blue-500
};

export function LeadsTemperatureChart({ data }: LeadsTemperatureChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Temperatura dos Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado de temperatura disponível
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-5 w-5" />
          Temperatura dos Leads
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }) => 
                `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
              }
              outerRadius={90}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={TEMPERATURE_COLORS[entry.name] || "hsl(var(--muted))"}
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => [
                `${value} leads (${((value / total) * 100).toFixed(1)}%)`,
                ""
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
