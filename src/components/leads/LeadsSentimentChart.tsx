import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LeadsSentimentChartProps {
  data: { name: string; value: number }[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  "Positivo": "hsl(var(--success))",
  "Neutro": "hsl(var(--warning))",
  "Negativo": "hsl(var(--destructive))"
};

export function LeadsSentimentChart({ data }: LeadsSentimentChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição de Sentimento</CardTitle>
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
                  fill={SENTIMENT_COLORS[entry.name] || "hsl(var(--muted))"}
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
