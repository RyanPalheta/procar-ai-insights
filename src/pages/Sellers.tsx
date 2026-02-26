import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SellersRankingTable, SellerKPI } from "@/components/sellers/SellersRankingTable";
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
  const [periodDays, setPeriodDays] = useState<"all" | "7" | "30" | "90">("30");

  const periodValue = periodDays === "all" ? null : parseInt(periodDays);

  // Fetch sellers KPIs
  const { data: sellersData, isLoading: loadingSellers } = useQuery({
    queryKey: ["sellers-kpis", periodDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sellers_kpis", {
        period_days: periodValue,
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
          <h2 className="text-3xl font-bold tracking-tight">Vendedores</h2>
          <p className="text-muted-foreground">
            Desempenho e metas por vendedor
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7", "30", "90", "all"] as const).map(p => (
            <Button
              key={p}
              variant={periodDays === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodDays(p)}
            >
              {p === "all" ? "Todos" : `${p}d`}
            </Button>
          ))}
        </div>
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
          periodDays={periodValue}
        />
      )}
    </div>
  );
}
