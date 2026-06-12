import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ClipboardCheck } from "lucide-react";

interface LeadsComplianceChartProps {
  data: {
    name: string;
    value: number;
    percentage: number;
  }[];
  avgScore: number;
  totalAudited: number;
}

// Escala semântica do tema (verde > lima > âmbar > vermelho)
const COMPLIANCE_COLORS: Record<string, string> = {
  "Excelente": "hsl(var(--success))",
  "Bom": "hsl(80 60% 45%)",
  "Regular": "hsl(var(--warning))",
  "Baixo": "hsl(var(--destructive-foreground))",
};

const chartConfig = {
  value: { label: "Leads" },
};

export function LeadsComplianceChart({ data, avgScore, totalAudited }: LeadsComplianceChartProps) {
  const hasData = totalAudited > 0;

  const getAvgScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 60) return "hsl(80 60% 45%)";
    if (score >= 40) return "hsl(var(--warning))";
    return "hsl(var(--destructive-foreground))";
  };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Distribuição de Compliance
            <ChartInfoTooltip
              description="Separa os clientes por nível de atendimento (Excelente, Bom, Regular ou Baixo). Cada fatia mostra quantos clientes ficaram em cada nível e o número no centro é a nota média de atendimento."
              source="conta os clientes que a IA já analisou e deu uma nota de atendimento, dentro do período e dos filtros que você escolheu."
              calculation="cada cliente recebe uma nota de atendimento de 0 a 100 e é colocado em um nível: 80 ou mais é Excelente, de 60 a 79 é Bom, de 40 a 59 é Regular e abaixo de 40 é Baixo. Contamos quantos clientes ficaram em cada nível, e o número do centro é a média de todas essas notas."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <>
              {/* Donut com rótulo central */}
              <div className="relative">
                <ChartContainer config={chartConfig} className="h-[180px] w-full aspect-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="70%"
                        outerRadius="95%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {data.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={COMPLIANCE_COLORS[entry.name] || "hsl(var(--chart-4))"}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div
                      className="text-2xl font-extrabold tabular-nums leading-none"
                      style={{ color: getAvgScoreColor(avgScore) }}
                    >
                      {avgScore.toFixed(0)}%
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      score médio
                    </div>
                  </div>
                </div>
              </div>

              {/* Legenda padrão: dot + nome + valor + % */}
              <div className="mt-4 space-y-2">
                {data.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-[3px]"
                        style={{ backgroundColor: COMPLIANCE_COLORS[entry.name] || "hsl(var(--chart-4))" }}
                      />
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-bold">{entry.value}</span>
                      <span className="text-muted-foreground text-xs w-12 text-right">
                        {entry.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
                {totalAudited} clientes analisados pela IA
              </div>
            </>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Sem dados de compliance disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
