import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { BarList } from "@tremor/react";

interface LeadsStatusChartProps {
  data: { name: string; value: number }[];
}

const getStatusTremorColor = (statusName: string): string => {
  const lowerName = statusName.toLowerCase();
  if (lowerName.includes('ganha') || lowerName.includes('fechad') || lowerName.includes('won')) return "emerald";
  if (lowerName.includes('perdida') || lowerName.includes('cancel') || lowerName.includes('lost')) return "red";
  if (lowerName.includes('atendimento') || lowerName.includes('qualificação')) return "rose";
  if (lowerName.includes('negociação') || lowerName.includes('proposta') || lowerName.includes('decisão')) return "amber";
  if (lowerName.includes('agendamento') || lowerName.includes('confirmad')) return "emerald";
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
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Leads por Status
            <ChartInfoTooltip
              description="Mostra os 5 status de venda mais comuns. Cada barra mostra quantos clientes estão naquele status e quanto isso representa do total."
              source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. A análise feita pela IA é enviada de volta ao Kommo. Aqui: só os clientes que já têm um status de venda definido."
              calculation="agrupa os clientes pelo status de venda, mostra os 5 status com mais clientes e, para cada um, quantos clientes têm aquele status dividido pelo total, vezes 100."
            />
          </CardTitle>
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
