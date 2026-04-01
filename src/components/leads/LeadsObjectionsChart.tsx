import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { BarList } from "@tremor/react";
import { AlertTriangle } from "lucide-react";

interface LeadsObjectionsChartProps {
  data: { name: string; value: number }[];
}

const OBJECTION_TREMOR_COLORS = [
  "red", "orange", "amber", "yellow", "lime",
  "emerald", "teal", "cyan", "sky", "blue",
];

export function LeadsObjectionsChart({ data }: LeadsObjectionsChartProps) {
  const safeData = data || [];
  const total = safeData.reduce((sum, item) => sum + item.value, 0);

  if (safeData.length === 0) {
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

  const barListData = safeData.map((item, index) => ({
    name: item.name,
    value: item.value,
    color: OBJECTION_TREMOR_COLORS[index % OBJECTION_TREMOR_COLORS.length],
  }));

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
