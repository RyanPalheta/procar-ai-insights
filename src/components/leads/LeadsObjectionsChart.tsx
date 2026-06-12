import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { BarList } from "@tremor/react";
import { AlertTriangle } from "lucide-react";

interface LeadsObjectionsChartProps {
  data: { name: string; value: number }[];
}

// Escala de "calor" da marca: objeção mais frequente = vermelho mais forte
const OBJECTION_TREMOR_COLORS = [
  "rose", "rose", "orange", "amber", "amber",
  "slate", "slate", "slate", "slate", "slate",
];

export function LeadsObjectionsChart({ data }: LeadsObjectionsChartProps) {
  const safeData = data || [];
  const total = safeData.reduce((sum, item) => sum + item.value, 0);

  if (safeData.length === 0) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
        <Card className="bg-card border-border h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Ranking de Objeções
              <ChartInfoTooltip
                description="Mostra os tipos de objeção que mais aparecem. Cada barra é um tipo de objeção e o número é quantas vezes ela apareceu nas conversas com os clientes."
                source="usa só os clientes em que a IA já analisou a conversa e identificou alguma objeção. Considera apenas o período e os filtros que você selecionou."
                calculation="contamos quantas vezes cada tipo de objeção apareceu (um mesmo cliente pode ter levantado vários tipos). A porcentagem mostra o peso de cada tipo dentro do total de objeções."
              />
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
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Ranking de Objeções
            <ChartInfoTooltip
              description="Mostra os tipos de objeção que mais aparecem. Cada barra é um tipo de objeção e o número é quantas vezes ela apareceu nas conversas com os clientes."
              source="usa só os clientes em que a IA já analisou a conversa e identificou alguma objeção. Considera apenas o período e os filtros que você selecionou."
              calculation="contamos quantas vezes cada tipo de objeção apareceu (um mesmo cliente pode ter levantado vários tipos). A porcentagem mostra o peso de cada tipo dentro do total de objeções."
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
