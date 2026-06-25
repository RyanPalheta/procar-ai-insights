import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge } from "lucide-react";
import type { GoogleAdsKPIs } from "@/types/google-ads";

interface Props {
  kpis?: GoogleAdsKPIs;
  loading?: boolean;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "warning" | "muted" }) {
  const color =
    tone === "warning" ? "text-warning" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
      <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function GoogleAdsImpressionShare({ kpis, loading }: Props) {
  if (loading) return <Skeleton className="h-[220px] rounded-lg" />;

  const is = kpis?.searchImpressionShare ?? 0;
  const lostBudget = kpis?.budgetLostIS ?? 0;
  const lostRank = kpis?.rankLostIS ?? 0;
  const hasData = is > 0 || lostBudget > 0 || lostRank > 0;

  const verdict = !hasData
    ? null
    : lostBudget >= lostRank
      ? {
          warn: true,
          text: "Você perde mais impressões por VERBA. Aumentar o orçamento tende a destravar mais aparições.",
        }
      : {
          warn: false,
          text: "Você perde mais por LANCE/qualidade. Mexer no orçamento ajuda pouco — foque em lance e na qualidade do anúncio.",
        };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="234, 179, 8">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4 text-warning" />
            Parcela de Impressões (Search)
            <ChartInfoTooltip
              description="De todas as vezes que seu anúncio PODERIA aparecer nas buscas, em quantas ele realmente apareceu — e por que deixou de aparecer."
              source="vem direto do Google Ads, só de campanhas de Search (PMax/Display não reportam essa métrica), no período."
              calculation="Parcela = impressões recebidas ÷ impressões elegíveis. As perdas se dividem entre falta de verba (orçamento) e lance/qualidade baixos."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sem dados de Search no período. Campanhas PMax/Display não reportam parcela de impressões —
              aparece aqui quando houver campanhas de Search com o script novo rodando.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Apareceu" value={pct(is)} tone="default" />
                <Stat label="Perdi por verba" value={pct(lostBudget)} tone="warning" />
                <Stat label="Perdi por lance" value={pct(lostRank)} tone="muted" />
              </div>
              {verdict && (
                <p
                  className={`text-xs rounded-md px-3 py-2 ${
                    verdict.warn
                      ? "bg-warning/10 text-warning border border-warning/25"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {verdict.text}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
