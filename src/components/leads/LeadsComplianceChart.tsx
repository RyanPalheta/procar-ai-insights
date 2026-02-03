import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
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

const COMPLIANCE_COLORS: Record<string, string> = {
  "Excelente": "#22c55e",
  "Bom": "#eab308",
  "Regular": "#f97316",
  "Baixo": "#ef4444",
};

export function LeadsComplianceChart({ data, avgScore, totalAudited }: LeadsComplianceChartProps) {
  const hasData = totalAudited > 0;
  
  // Get color based on average score
  const getAvgScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="34, 197, 94">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Distribuição de Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <>
              {/* Gauge Chart with center value */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="100%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COMPLIANCE_COLORS[entry.name] || "hsl(var(--muted))"} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center value overlay */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-2">
                  <div 
                    className="text-3xl font-bold"
                    style={{ color: getAvgScoreColor(avgScore) }}
                  >
                    {avgScore.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Média de Compliance
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {data.map((entry, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COMPLIANCE_COLORS[entry.name] }}
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
                {totalAudited} leads auditados
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
