import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface LeadsSentimentChartProps {
  data: { name: string; value: number }[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  "Positivo": "hsl(var(--success))",
  "Neutro": "hsl(var(--warning))",
  "Negativo": "hsl(var(--destructive))",
  "N/A": "hsl(var(--muted))"
};

export function LeadsSentimentChart({ data }: LeadsSentimentChartProps) {
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
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
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
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
