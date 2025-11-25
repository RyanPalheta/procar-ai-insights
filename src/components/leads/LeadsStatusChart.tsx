import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from "recharts";

interface LeadsStatusChartProps {
  data: { name: string; value: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "Venda Ganha": "hsl(142, 71%, 45%)", // Verde
  "Venda Perdida": "hsl(0, 84%, 60%)", // Vermelho
  "Novo Lead": "hsl(217, 91%, 60%)", // Azul
  "Em Negociação": "hsl(45, 93%, 47%)", // Amarelo
  "Em Qualificação": "hsl(271, 91%, 65%)", // Roxo
  "Follow-up": "hsl(24, 95%, 53%)", // Laranja
};

const getStatusColor = (statusName: string): string => {
  return STATUS_COLORS[statusName] || "hsl(var(--muted))";
};

export function LeadsStatusChart({ data }: LeadsStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="hsl(var(--muted-foreground))" 
              width={120}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)"
              }}
              formatter={(value: number) => {
                const percentage = ((value / total) * 100).toFixed(1);
                return [`${value} (${percentage}%)`, "Quantidade"];
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
              ))}
              <LabelList 
                dataKey="value" 
                position="right" 
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(0);
                  return `${value} (${percentage}%)`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
