import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LeadsChannelChartProps {
  data: { name: string; value: number }[];
}

const CHANNEL_COLORS: Record<string, string> = {
  "WhatsApp": "hsl(142, 71%, 45%)", // Verde
  "Facebook": "hsl(217, 91%, 60%)", // Azul
  "Instagram": "hsl(330, 81%, 56%)", // Rosa
};

const getChannelColor = (channelName: string): string => {
  return CHANNEL_COLORS[channelName] || "hsl(var(--muted))";
};

export function LeadsChannelChart({ data }: LeadsChannelChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por Canal</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {data.map((entry, index) => (
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
