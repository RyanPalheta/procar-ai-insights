import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, TrendingDown, Copy, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KommoReconciliation {
  captured_at: string;
  window_days: number;
  kommo_total: number;
  dashboard_total: number;
  dashboard_audited: number | null;
  gap: number; // kommo_total - dashboard_total ; > 0 = subcontagem ; < 0 = painel a mais
  gap_pct: number | null;
  gap_pct_7d_ago: number | null;
}

/**
 * Saúde da base — compara o volume de leads do painel (lead_db) com a base real da Kommo
 * no mesmo período, medido 1x/dia pela edge function reconcile-kommo.
 *
 * ATENÇÃO (honestidade do número): é uma comparação por CONTAGEM BRUTA. Como o lead_db
 * ainda não tem chave de deduplicação (telefone), um lead que veio pelo chat E também
 * está na Kommo aparece 2× (linha de chat + espelho kommo_sync), inflando o painel. Por
 * isso mostramos o desvio bruto + a ressalva — e NÃO um "% de cobertura" (que passava de
 * 100% justamente por causa da duplicação). A dedup por telefone está no plano.
 */
export function KommoHealthCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["kommo-reconciliation"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_kommo_reconciliation");
      if (error) throw error;
      const rows = (data as KommoReconciliation[]) || [];
      return rows[0] ?? null;
    },
  });

  const painel = data?.dashboard_total ?? 0;
  const kommo = data?.kommo_total ?? 0;
  const gap = data?.gap ?? 0; // > 0 = faltam ; < 0 = painel tem a mais (provável duplicação)
  const excedente = gap < 0 ? -gap : 0;
  const desvioPct = kommo > 0 ? Math.round(((painel - kommo) / kommo) * 1000) / 10 : null; // + = painel acima

  const header = (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4 text-primary" />
      <div>
        <h3 className="font-semibold leading-tight flex items-center gap-1.5">
          Saúde da base (Kommo × painel)
          <ChartInfoTooltip
            description="Compara quantos leads o painel tem vs a base real da Kommo no mesmo período. Serve para monitorar a convergência da base ao longo do tempo."
            source="Edge function reconcile-kommo: conta os leads criados na Kommo (API v4) e as linhas do lead_db no mesmo intervalo. Medido 1x/dia (snapshot)."
            calculation="Desvio = (painel − Kommo) ÷ Kommo. Ressalva: é contagem BRUTA. O lead_db ainda não guarda telefone para deduplicar, então um lead que veio pelo chat E está na Kommo pode contar 2× (chat + espelho kommo_sync), inflando o painel. Dedup por telefone está no plano."
          />
        </h3>
        <p className="text-xs text-muted-foreground">Convergência da base (janela móvel, atualizada diariamente)</p>
      </div>
    </div>
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {header}

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Sem reconciliação ainda. O cron diário (<code className="font-mono text-xs">reconcile-kommo</code>) preenche
            este card.
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            {/* Painel vs Kommo */}
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">{painel.toLocaleString("en-US")}</span>
                <span className="text-sm text-muted-foreground">leads no painel</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Kommo: {kommo.toLocaleString("en-US")} no período
                {desvioPct != null && (
                  <>
                    {" · painel "}
                    <span className="font-medium text-foreground">
                      {desvioPct >= 0 ? "+" : ""}
                      {desvioPct}%
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Interpretação do desvio */}
            <div className="flex flex-col items-end gap-1.5">
              {gap > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <TrendingDown className="h-3.5 w-3.5" />
                  faltam {gap.toLocaleString("en-US")} vs Kommo
                </span>
              ) : excedente > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Copy className="h-3.5 w-3.5" />
                  +{excedente.toLocaleString("en-US")} a deduplicar (chat/Kommo)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  em linha com a Kommo
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Janela {data.window_days}d · atualizado{" "}
                {formatDistanceToNow(new Date(data.captured_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
