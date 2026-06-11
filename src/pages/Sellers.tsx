import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { SellersRankingTable, SellerKPI, SellerShopmonkeyKPI } from "@/components/sellers/SellersRankingTable";
import { GoalData } from "@/components/sellers/SellerGoalStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";

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

  // Funil real da loja por vendedor (ShopMonkey + Kommo) — mesclado nos cards
  const { data: shopmonkeyData, isLoading: loadingShopmonkey } = useQuery({
    queryKey: ["sellers-shopmonkey-kpis", range.fromIso, range.toIso],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_sellers_shopmonkey_kpis", {
        date_from: range.fromIso,
        date_to: range.toIso,
      });
      if (error) throw error;
      return (data as SellerShopmonkeyKPI[]) || [];
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
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Vendedores
            <ChartInfoTooltip
              description="Visão unificada por vendedor: o que ele PRODUZIU (funil real da loja — leads da Kommo, orçamentos, agendamentos por canal, vendas e receita do ShopMonkey) e COMO atendeu no chat (qualidade avaliada pela IA na amostra de conversas de WhatsApp)."
              source="Funil: leads = oportunidades do vendedor na Kommo; orçamentos, agendamentos, vendas e receita = sistema da loja (ShopMonkey), com o vendedor lido do texto do agendamento (~93%). Qualidade: amostra de conversas de chat auditadas pela IA — é um SUBCONJUNTO, não a atividade total (clientes de telefone/presenciais não passam pelo chat)."
              calculation="Conversão = vendas pagas ÷ total de leads do vendedor. Taxa de agendamento = agendamentos ÷ leads. Score médio e objeções superadas vêm só das conversas auditadas pela IA."
            />
          </h2>
          <p className="text-muted-foreground">
            Funil da loja + qualidade do chat (IA), por vendedor
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {loadingSellers || loadingShopmonkey ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <SellersRankingTable
          sellers={sellersData || []}
          shopmonkey={shopmonkeyData || []}
          goals={[]}
          sellerGoalsMap={sellerGoalsMap}
          dateFrom={range.fromIso}
          dateTo={range.toIso}
        />
      )}
    </div>
  );
}
