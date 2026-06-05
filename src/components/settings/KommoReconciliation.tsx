import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { AlertTriangle, RefreshCw, ArrowDownUp } from "lucide-react";

interface ReconResult {
  range: { date_from: string; date_to: string };
  kommo: { total: number; by_status: { status_id: number; label: string; count: number }[]; truncated: boolean };
  dashboard: { total: number; audited: number };
  gap: number;
  gap_pct: number | null;
  note: string;
}

/**
 * Reconciliação Kommo × Dashboard (P0.2 do diagnóstico de confiabilidade).
 * Mede o gap real: quantos leads existem na Kommo (fonte da verdade) vs. no lead_db.
 */
export function KommoReconciliation() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: "today" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const range = resolvePeriod(period);
    if (!range.fromIso || !range.toIso) {
      setError("Selecione um período com início e fim (não use 'Todos').");
      setLoading(false);
      return;
    }
    const { data, error: invokeErr } = await supabase.functions.invoke("reconcile-kommo", {
      body: { date_from: range.fromIso, date_to: range.toIso },
    });
    setLoading(false);
    if (invokeErr) {
      setError(invokeErr.message);
      return;
    }
    if ((data as { error?: string })?.error) {
      setError((data as { error: string }).error);
      return;
    }
    setResult(data as ReconResult);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="h-5 w-5" /> Reconciliação Kommo × Dashboard
        </CardTitle>
        <CardDescription>
          Para o período escolhido, compara quantos leads foram criados na Kommo (fonte real) com quantos
          existem no dashboard (<code>lead_db</code>). O <strong>gap</strong> mede exatamente quantos leads o BI
          está deixando de fora. Somente leitura — não altera nada na Kommo nem no banco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter value={period} onChange={setPeriod} presets={["today", "yesterday", "7", "30", "90"]} />
          <Button onClick={run} disabled={loading} className="gap-2">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Reconciliar
          </Button>
        </div>

        {loading && <Skeleton className="h-40 rounded-lg" />}

        {error && (
          <Alert className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível reconciliar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Kommo (real)" value={result.kommo.total} />
              <Stat label="Dashboard (lead_db)" value={result.dashboard.total} />
              <Stat label="Auditados (IA)" value={result.dashboard.audited} muted />
              <Stat
                label="Gap (faltando no BI)"
                value={`${result.gap}${result.gap_pct !== null ? ` (${result.gap_pct}%)` : ""}`}
                danger={result.gap > 0}
              />
            </div>

            {result.kommo.truncated && (
              <p className="text-xs text-amber-600">
                ⚠️ Resultado truncado (muitos leads no período) — refine o intervalo.
              </p>
            )}

            {result.kommo.by_status.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1.5">Leads da Kommo por etapa (período)</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.kommo.by_status.map((s) => (
                    <Badge key={s.status_id} variant="outline" className="text-xs font-normal">
                      {s.label}: <span className="ml-1 font-semibold">{s.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">{result.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  danger,
  muted,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${danger ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${danger ? "text-destructive" : muted ? "text-muted-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}
