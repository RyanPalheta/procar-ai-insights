import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { DonutChart } from "@tremor/react";
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

const COMPLIANCE_COLORS_MAP: Record<string, string> = {
  "Excelente": "emerald",
  "Bom": "yellow",
  "Regular": "orange",
  "Baixo": "red",
};

const COMPLIANCE_DOT_COLORS: Record<string, string> = {
  "Excelente": "#22c55e",
  "Bom": "#eab308",
  "Regular": "#f97316",
  "Baixo": "#ef4444",
};

export function LeadsComplianceChart({ data, avgScore, totalAudited }: LeadsComplianceChartProps) {
  const hasData = totalAudited > 0;

  const getAvgScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  const colors = data.map(d => COMPLIANCE_COLORS_MAP[d.name] || "gray");

  return (
    <MagicBentoCard className="rounded-lg" glowColor="34, 197, 94">
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
              {/* Donut with center value */}
              <div className="relative">
                <DonutChart
                  data={data}
                  category="value"
                  index="name"
                  colors={colors}
                  showAnimation={true}
                  showTooltip={true}
                  className="h-[180px]"
                  showLabel={false}
                />
                {/* Center label overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold"
                      style={{ color: getAvgScoreColor(avgScore) }}
                    >
                      {avgScore.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Média
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {data.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COMPLIANCE_DOT_COLORS[entry.name] }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{entry.value} leads</span>
                      <span className="text-muted-foreground w-12 text-right">
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
