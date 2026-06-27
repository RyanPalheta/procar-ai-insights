import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Phone, Target } from "lucide-react";
import type { GoogleAdsConversionAction } from "@/types/google-ads";

interface Props {
  actions: GoogleAdsConversionAction[];
  /** Total de conversões "todas" (allConversions), pro selo do canto. */
  total: number;
  loading?: boolean;
}

const isCall = (a: GoogleAdsConversionAction) =>
  /call|phone|ligac|ligaç/i.test(`${a.category} ${a.name}`);

export function GoogleAdsConversionActions({ actions, total, loading }: Props) {
  if (loading) return <Skeleton className="h-[220px] rounded-lg" />;

  const sum = actions.reduce((s, a) => s + a.conversions, 0);
  const max = actions.reduce((m, a) => Math.max(m, a.conversions), 0);

  return (
    <MagicBentoCard className="rounded-lg" glowColor="16, 185, 129">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-success" />
            Conversões por tipo
            <ChartInfoTooltip
              description="Separa as conversões por TIPO de ação (ligação, formulário, etc.), pra você ver de onde vêm os leads. Ligações ficam destacadas."
              source="vem direto do Google Ads (as ações de conversão configuradas na conta), no período."
              calculation="soma as conversões de cada tipo de ação no período e mostra a participação de cada uma."
            />
            {total > 0 && (
              <Badge variant="outline" className="ml-auto whitespace-nowrap">
                {Math.round(total)} no total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sem dados de conversões por tipo ainda. Aparece aqui assim que o script novo
              (com a segunda consulta) rodar.
            </p>
          ) : (
            <div className="space-y-2.5">
              {actions.map((a) => {
                const call = isCall(a);
                const share = sum > 0 ? (a.conversions / sum) * 100 : 0;
                const barW = max > 0 ? (a.conversions / max) * 100 : 0;
                return (
                  <div key={a.name}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium flex items-center gap-1.5 min-w-0">
                        {call && <Phone className="h-3 w-3 text-success shrink-0" />}
                        <span className="truncate">{a.name}</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                        {Math.round(a.conversions)} · {share.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${call ? "bg-success" : "bg-primary"}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
