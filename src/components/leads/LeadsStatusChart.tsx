import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarList } from "@tremor/react";

interface LeadsStatusChartProps {
  data: { name: string; value: number }[];
}

const getStatusTremorColor = (statusName: string): string => {
  const lowerName = statusName.toLowerCase();
  if (lowerName.includes('ganha') || lowerName.includes('fechad') || lowerName.includes('won')) return "emerald";
  if (lowerName.includes('perdida') || lowerName.includes('cancel') || lowerName.includes('lost')) return "red";
  if (lowerName.includes('atendimento') || lowerName.includes('qualificação')) return "blue";
  if (lowerName.includes('negociação') || lowerName.includes('proposta') || lowerName.includes('decisão')) return "amber";
  if (lowerName.includes('agendamento') || lowerName.includes('confirmad')) return "cyan";
  if (lowerName.includes('faltou')) return "red";
  if (lowerName.includes('follow') || lowerName.includes('recuperação')) return "orange";
  if (lowerName.includes('aguardando') || lowerName.includes('inicial') || lowerName.includes('contato')) return "slate";
  return "gray";
};

export function LeadsStatusChart({ data }: LeadsStatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const barListData = data.map((item) => ({
    name: item.name,
    value: item.value,
    color: getStatusTremorColor(item.name),
  }));

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle>Leads por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList
            data={barListData}
            valueFormatter={(v: number) => {
              const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
              return `${v} (${pct}%)`;
            }}
            className="mt-1"
          />
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
