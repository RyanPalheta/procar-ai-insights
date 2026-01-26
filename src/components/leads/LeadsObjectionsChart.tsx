import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { AlertTriangle } from "lucide-react";

interface LeadsObjectionsChartProps {
  data: { name: string; value: number }[];
}

// Cores para diferentes categorias de objeção
const OBJECTION_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange  
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0ea5e9", // Sky
  "#3b82f6", // Blue
];

export function LeadsObjectionsChart({ data }: LeadsObjectionsChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (data.length === 0) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="239, 68, 68">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Ranking de Objeções
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground text-sm">Nenhuma objeção registrada</p>
          </CardContent>
        </Card>
      </MagicBentoCard>
    );
  }
  
  return (
    <MagicBentoCard className="rounded-lg" glowColor="239, 68, 68">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Ranking de Objeções
          </CardTitle>
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
                width={140}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(1);
                  return [`${value} leads (${percentage}%)`, "Ocorrências"];
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={OBJECTION_COLORS[index % OBJECTION_COLORS.length]} />
                ))}
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  fill="hsl(var(--muted-foreground))"
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
    </MagicBentoCard>
  );
}
