import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartContainer } from "@/components/ui/chart";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Filter } from "lucide-react";
import type { MetaAdsKPIs } from "@/types/meta-ads";
import { formatCompact, formatPercentBR } from "@/lib/format";

interface MetaAdsFunnelChartProps {
  data: MetaAdsKPIs;
}

const chartConfig = {
  display: {
    label: "Quantidade",
    color: "hsl(var(--chart-1))",
  },
};

// Progressão da paleta: neutro no topo do funil, marca no fundo (conversão)
const COLORS = [
  "hsl(var(--chart-4) / 0.6)",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-1) / 0.8)",
  "hsl(var(--chart-1))",
];

export function MetaAdsFunnelChart({ data }: MetaAdsFunnelChartProps) {
  const steps = [
    { name: "Impressoes", value: data.impressions },
    { name: "Cliques", value: data.clicks },
    { name: "Leads", value: data.leads },
    { name: "Compras", value: data.purchases },
  ];

  // Barras em escala log para as etapas finais não sumirem ao lado das impressões;
  // os números reais (e a taxa de passagem) ficam no rótulo de cada barra.
  const funnelData = steps.map((step, i) => {
    const prev = i > 0 ? steps[i - 1].value : 0;
    const rate = i > 0 && prev > 0 ? (step.value / prev) * 100 : null;
    return {
      ...step,
      display: step.value > 0 ? Math.log10(step.value + 1) : 0,
      label: rate !== null
        ? `${formatCompact(step.value)}  ·  ${formatPercentBR(rate)}`
        : formatCompact(step.value),
    };
  });

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Funil de Conversao
            <ChartInfoTooltip
              description="Mostra o caminho do anuncio ate a venda em 4 etapas (Impressoes, Cliques, Leads e Compras). Cada barra mostra o total daquela etapa e a porcentagem ao lado e a taxa de passagem da etapa anterior para ela. As larguras usam escala comprimida para todas as etapas ficarem visiveis."
              source="os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado."
              calculation="cada etapa soma o total do periodo: quantas vezes o anuncio apareceu (impressoes), quantos cliques teve, quantos leads a Meta registrou e quantas compras foram atribuidas aos anuncios. A taxa de passagem e o valor da etapa dividido pelo valor da etapa anterior, vezes 100."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 10, right: 95, left: 0, bottom: 0 }}>
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500 }}
                  width={85}
                />
                <Bar dataKey="display" radius={[0, 6, 6, 0]} barSize={30}>
                  {funnelData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="right"
                    className="fill-foreground"
                    style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
