import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#9ca3af"];

export interface ProductIntel {
  product: string;
  leads: number;
  share_pct: number;
  as_upsell: number;
}

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

/**
 * Inteligência de Produtos — ranking dos serviços/produtos detectados pela IA nas
 * conversas (services_detected), com participação (%) e quantas vezes cada um
 * aparece como oportunidade de upsell (upsell_products). Subconjunto de chat
 * auditado (rotulado). Atende ao pedido transversal "destrinchar por produto".
 */
export function ProductIntelligence({ dateFrom, dateTo }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-intelligence", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_product_intelligence", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return (data as ProductIntel[]) || [];
    },
  });

  const all = data || [];
  const rows = all.slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => Number(r.leads)));
  const pieData = all.slice(0, 6).map((r) => ({ name: r.product, value: Number(r.leads) }));
  const restLeads = all.slice(6).reduce((a, r) => a + Number(r.leads), 0);
  if (restLeads > 0) pieData.push({ name: "Outros", value: restLeads });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold leading-tight flex items-center gap-1.5">
              Inteligência de Produtos
              <ChartInfoTooltip
                description="Ranking dos serviços/produtos mais detectados pela IA nas conversas, com participação (%) e quantas vezes cada um aparece como oportunidade de upsell."
                source="lead_db (Supabase): só leads de chat auditados pela IA (last_ai_update) no período — é um SUBCONJUNTO da Kommo. Demanda = services_detected; upsell = upsell_products."
                calculation="Conta leads distintos por produto em services_detected; share % = leads do produto ÷ leads com algum produto detectado. 'Upsell' = leads distintos em que o produto aparece em upsell_products."
              />
            </h3>
            <p className="text-xs text-muted-foreground">Demanda · share · oportunidade de upsell (chat auditado)</p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem produtos detectados no período.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={82} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} leads`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.product} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.product}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {Number(r.as_upsell) > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"
                        title="Leads em que apareceu como oportunidade de upsell"
                      >
                        <TrendingUp className="h-3 w-3" />
                        {r.as_upsell}
                      </span>
                    )}
                    <span className="tabular-nums">
                      <b className="text-foreground">{r.leads}</b> · {Number(r.share_pct).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(r.leads) / max) * 100}%` }} />
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
