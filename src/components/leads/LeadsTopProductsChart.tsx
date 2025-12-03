import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface LeadsTopProductsChartProps {
  data: { name: string; value: number }[];
}

export function LeadsTopProductsChart({ data }: LeadsTopProductsChartProps) {
  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader>
          <CardTitle className="text-white">Top 5 Produtos Desejados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#392e4e" />
              <XAxis 
                dataKey="name" 
                stroke="#9ca3af"
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "#1a1025",
                  border: "1px solid #392e4e",
                  borderRadius: "8px",
                  color: "white"
                }}
              />
              <Legend wrapperStyle={{ color: "white" }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
