import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

interface LeadsStatusChartProps {
  data: { name: string; value: number }[];
}

// Paleta semântica baseada no funil de vendas
const STATUS_COLORS: Record<string, string> = {
  // Etapas iniciais - tons de slate
  "Aguardando atendimento": "#64748b",
  "Contato inicial": "#64748b",
  
  // Em progresso - tons de azul
  "Em atendimento (qualificação)": "#3b82f6",
  "Em qualificação": "#3b82f6",
  "Qualificação": "#3b82f6",
  
  // Agendamento - tons de cyan/teal
  "Agendamento confirmado": "#06b6d4",
  "Faltou agendamento": "#dc2626",
  
  // Negociação - tons de âmbar
  "Em Negociação": "#f59e0b",
  "Proposta/Negociação": "#f59e0b",
  "Tomada de decisão": "#f59e0b",
  
  // Follow-up - laranja
  "Follow-up": "#f97316",
  "Recuperação de clientes": "#f97316",
  
  // Finais positivos - verde
  "Venda ganha": "#22c55e",
  "Venda Ganha": "#22c55e",
  
  // Finais negativos - vermelho
  "Venda perdida": "#ef4444",
  "Venda Perdida": "#ef4444",
  "Cancelamento": "#ef4444",
};

const getStatusColor = (statusName: string): string => {
  // Match exato
  if (STATUS_COLORS[statusName]) {
    return STATUS_COLORS[statusName];
  }
  
  // Match por palavra-chave (case-insensitive)
  const lowerName = statusName.toLowerCase();
  
  if (lowerName.includes('ganha') || lowerName.includes('fechad') || lowerName.includes('won')) {
    return "#22c55e"; // Verde
  }
  if (lowerName.includes('perdida') || lowerName.includes('cancel') || lowerName.includes('lost')) {
    return "#ef4444"; // Vermelho
  }
  if (lowerName.includes('atendimento') || lowerName.includes('qualificação')) {
    return "#3b82f6"; // Azul
  }
  if (lowerName.includes('negociação') || lowerName.includes('proposta') || lowerName.includes('decisão')) {
    return "#f59e0b"; // Âmbar
  }
  if (lowerName.includes('agendamento') || lowerName.includes('confirmad')) {
    return "#06b6d4"; // Cyan
  }
  if (lowerName.includes('faltou')) {
    return "#dc2626"; // Vermelho escuro
  }
  if (lowerName.includes('follow') || lowerName.includes('recuperação')) {
    return "#f97316"; // Laranja
  }
  if (lowerName.includes('aguardando') || lowerName.includes('inicial') || lowerName.includes('contato')) {
    return "#64748b"; // Slate
  }
  
  // Fallback: cor baseada em hash do nome (sempre a mesma cor para o mesmo status)
  const hash = statusName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

export function LeadsStatusChart({ data }: LeadsStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
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
                  borderRadius: "8px"
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
