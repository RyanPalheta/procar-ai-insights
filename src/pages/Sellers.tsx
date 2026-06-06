import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { SellersRankingTable, SellerKPI } from "@/components/sellers/SellersRankingTable";
import { SellersShopmonkeyKPIs } from "@/components/sellers/SellersShopmonkeyKPIs";
import { GoalData } from "@/components/sellers/SellerGoalStatus";
import { Skeleton } from "@/components/ui/skeleton";

const METRIC_LABELS: Record<string, string> = {
  conversion_rate: "Taxa de Conversão",
  leads_with_quote: "Leads c/ Cotação",
  avg_quoted_price: "Valor Médio Cotado",
  objections_overcome_rate: "Objeções Superadas",
  median_first_response_time: "Tempo 1ª Resposta",
  walking_leads: "Leads Presenciais",
  avg_score: "Score Médio",
};

export default function Sellers() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: "30" });
  const range = useMemo(() => resolvePeriod(period), [period]);

  // Fetch sellers KPIs
  const { data: sellersData, isLoading: loadingSellers } = useQuery({
    queryKey: ["sellers-kpis", range.fromIso, range.toIso],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sellers_kpis", {
        date_from: range.fromIso,
        date_to: range.toIso,
      });
      if (error) throw error;
      return (data as unknown as SellerKPI[]) || [];
    },
  });

  // Fetch goals
  const { data: goalsData } = useQuery({
    queryKey: ["seller-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_goals")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Build goals map: seller_id -> GoalData[]
  const sellerGoalsMap = useMemo(() => {
    const map = new Map<string, GoalData[]>();
    if (!goalsData || !sellersData) return map;

    // Separate global vs specific goals
    const globalGoals = goalsData.filter(g => !g.seller_id);
    const specificGoals = goalsData.filter(g => g.seller_id);

    sellersData.forEach(seller => {
      const sellerSpecific = specificGoals.filter(g => g.seller_id === seller.seller_id);
      const metricsWithSpecific = new Set(sellerSpecific.map(g => g.metric));

      // Merge: specific goals + global fallbacks
      const allGoals = [
        ...sellerSpecific,
        ...globalGoals.filter(g => !metricsWithSpecific.has(g.metric)),
      ];

      const goalDataList: GoalData[] = allGoals.map(g => {
        let currentValue = 0;
        switch (g.metric) {
          case "conversion_rate":
            currentValue = seller.total_audited > 0 ? (seller.won_leads / seller.total_audited) * 100 : 0;
            break;
          case "leads_with_quote":
            currentValue = seller.leads_with_quote;
            break;
          case "avg_quoted_price":
            currentValue = seller.avg_quoted_price;
            break;
          case "objections_overcome_rate":
            currentValue = seller.total_with_objection > 0 ? (seller.objections_overcome / seller.total_with_objection) * 100 : 0;
            break;
          case "walking_leads":
            currentValue = seller.walking_leads;
            break;
          case "avg_score":
            currentValue = seller.avg_score;
            break;
          default:
            currentValue = 0;
        }

        return {
          metric: g.metric,
          metricLabel: METRIC_LABELS[g.metric] || g.metric,
          target: Number(g.target),
          direction: g.direction,
          currentValue,
        };
      });

      map.set(seller.seller_id, goalDataList);
    });

    return map;
  }, [goalsData, sellersData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Vendedores</h2>
          <p className="text-muted-foreground">
            Desempenho e metas por vendedor
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Números REAIS por vendedor (ShopMonkey): cadastra TODOS os vendedores e
          separa agendamento × venda — o que a auditoria pede e o painel de chat/IA
          abaixo (auditados) não cobre. */}
      <SellersShopmonkeyKPIs dateFrom={range.fromIso} dateTo={range.toIso} />

      <div className="space-y-1 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-950/10 p-3">
        <h3 className="text-sm font-semibold">Qualidade do atendimento no chat (amostra auditada pela IA)</h3>
        <p className="text-xs text-muted-foreground">
          Mede conversão, objeções e cotações dos leads de <b>chat (WhatsApp)</b> que a IA analisou — é um
          <b> subconjunto</b>, NÃO a atividade total da loja. Por isso os números <b>não batem</b> com o painel
          ShopMonkey acima: um vendedor costuma ter <b>mais agendamentos</b> (loja real) do que leads de chat
          auditados (ex.: clientes de telefone/presenciais não passam pelo chat).
        </p>
      </div>

      {loadingSellers ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <SellersRankingTable
          sellers={sellersData || []}
          goals={[]}
          sellerGoalsMap={sellerGoalsMap}
          dateFrom={range.fromIso}
          dateTo={range.toIso}
        />
      )}
    </div>
  );
}
