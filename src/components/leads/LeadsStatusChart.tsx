import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

interface LeadsStatusChartProps {
  data: { name: string; value: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "Venda Ganha": "hsl(142, 71%, 45%)",
  "Venda Perdida": "hsl(0, 84%, 60%)",
  "Novo Lead": "hsl(217, 91%, 60%)",
  "Em Negociação": "hsl(45, 93%, 47%)",
  "Em Qualificação": "hsl(271, 91%, 65%)",
  "Follow-up": "hsl(24, 95%, 53%)",
};

const getStatusColor = (statusName: string): string => {
  return STATUS_COLORS[statusName] || "hsl(var(--muted))";
};

export function LeadsStatusChart({ data }: LeadsStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <MagicBentoCard className="rounded-lg" glowColor="132, 0, 255">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader>
          <CardTitle className="text-white">Leads por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#392e4e" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#9ca3af" 
                width={120}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "#1a1025",
                  border: "1px solid #392e4e",
                  borderRadius: "8px",
                  color: "white"
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
                  fill="#9ca3af"
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
