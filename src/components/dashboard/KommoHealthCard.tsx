import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KommoReconciliation {
  captured_at: string;
  window_days: number;
  kommo_total: number;
  dashboard_total: number;
  dashboard_audited: number | null;
  gap: number;
  gap_pct: number | null;
  gap_pct_7d_ago: number | null;
}

/**
 * Saúde da base — convergência Kommo × painel. Mostra quantos % dos leads da Kommo já
 * estão refletidos no dashboard (cobertura) e quantos ainda faltam (gap), medido 1x/dia
 * pela edge function reconcile-kommo (snapshot diário). Responde diretamente ao item
 * central da auditoria ("os volumes divergem da base real da Kommo").
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

  // cobertura = leads no painel ÷ leads na Kommo (= 100 − gap_pct)
  const cobertura =
    data && data.kommo_total > 0 ? Math.round((data.dashboard_total / data.kommo_total) * 1000) / 10 : null;
  const cobertura7d = data && data.gap_pct_7d_ago != null ? Math.round((100 - data.gap_pct_7d_ago) * 10) / 10 : null;
  const delta = cobertura != null && cobertura7d != null ? Math.round((cobertura - cobertura7d) * 10) / 10 : null;

  const tone =
    cobertura == null
      ? ""
      : cobertura >= 90
        ? "text-emerald-600 dark:text-emerald-400"
        : cobertura >= 75
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  const header = (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4 text-primary" />
      <div>
        <h3 className="font-semibold leading-tight flex items-center gap-1.5">
          Saúde da base (Kommo × painel)
          <ChartInfoTooltip
            description="Quanto da base real da Kommo já está refletida no dashboard. 100% = o painel tem todos os leads que existem na Kommo no período."
            source="Edge function reconcile-kommo: conta os leads criados na Kommo (API v4) e compara com o lead_db no mesmo intervalo. Medido 1x/dia (snapshot)."
            calculation="Cobertura = leads no painel ÷ leads na Kommo. Faltam = leads na Kommo que ainda não estão no painel. Variação = cobertura de hoje − a de ~7 dias atrás (em pontos percentuais)."
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
            este card; ou rode a função uma vez para medir agora.
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            {/* Cobertura */}
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${tone}`}>{cobertura?.toFixed(1)}%</span>
                <span className="text-sm text-muted-foreground">da Kommo no painel</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {data.dashboard_total.toLocaleString("en-US")} de {data.kommo_total.toLocaleString("en-US")} leads
                {data.gap > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">{data.gap.toLocaleString("en-US")}</span> ainda faltam
                  </>
                )}
              </p>
            </div>

            {/* Tendência */}
            <div className="flex flex-col items-end gap-1.5">
              {delta != null && delta !== 0 && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${
                    delta > 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {delta > 0 ? "+" : ""}
                  {delta} pp em 7 dias
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
