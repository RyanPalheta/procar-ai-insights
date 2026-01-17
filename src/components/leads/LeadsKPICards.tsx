import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { TrendingUp, Award, Clock, DollarSign, Receipt } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ScorePeriod = "all" | "7" | "30" | "90";

interface LeadsKPICardsProps {
  conversionRate: number;
  conversionRateVariation: number | null;
  avgScore: number;
  scoreVariation: number | null;
  leadsWithQuoteVariation: number | null;
  newLeads24h: number;
  newLeads24hVariation: number | null;
  leadsWithQuote: number;
  avgQuotedPrice: number;
  avgQuotedPriceVariation: number | null;
  scorePeriod: ScorePeriod;
  onScorePeriodChange: (period: ScorePeriod) => void;
}

const periodLabels: Record<ScorePeriod, string> = {
  "all": "Todos",
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias"
};

export function LeadsKPICards({
  conversionRate,
  conversionRateVariation,
  avgScore,
  scoreVariation,
  leadsWithQuoteVariation,
  newLeads24h,
  newLeads24hVariation,
  leadsWithQuote,
  avgQuotedPrice,
  avgQuotedPriceVariation,
  scorePeriod,
  onScorePeriodChange
}: LeadsKPICardsProps) {
  const getTrend = (variation: number | null, alwaysShow = false) => {
    if (variation === null) return undefined;
    if (!alwaysShow && scorePeriod === "all") return undefined;
    return {
      value: Math.abs(parseFloat(variation.toFixed(1))),
      isPositive: variation >= 0
    };
  };

  return (
    <MagicBentoGrid
      enableSpotlight={true}
      spotlightRadius={300}
      glowColor="59, 130, 246"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Taxa de Conversão"
          value={`${conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          variant={conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "destructive"}
          description="Leads ganhos vs total"
          trend={getTrend(conversionRateVariation)}
        />
        
        <div className="relative">
          <KPICard
            title="Score Médio"
            value={avgScore.toFixed(1)}
            icon={Award}
            variant={avgScore >= 7 ? "success" : avgScore >= 5 ? "warning" : "destructive"}
            description={scorePeriod === "all" ? "Período: Todos" : `Período: ${periodLabels[scorePeriod]}`}
            trend={getTrend(scoreVariation)}
          />
          <div className="absolute top-3 right-3 z-10">
            <Select value={scorePeriod} onValueChange={(v) => onScorePeriodChange(v as ScorePeriod)}>
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <KPICard
          title="Leads Novos (24h)"
          value={newLeads24h}
          icon={Clock}
          variant="default"
          description="vs. 24h anteriores"
          trend={getTrend(newLeads24hVariation, true)}
        />
        
        <KPICard
          title="Leads com Cotação"
          value={leadsWithQuote}
          icon={Receipt}
          variant="default"
          description={scorePeriod === "all" ? "Com preço definido" : `Período: ${periodLabels[scorePeriod]}`}
          trend={getTrend(leadsWithQuoteVariation)}
        />
        
        <KPICard
          title="Valor Médio Cotado"
          value={avgQuotedPrice > 0 ? `R$ ${avgQuotedPrice.toFixed(2)}` : "N/A"}
          icon={DollarSign}
          variant="success"
          description={scorePeriod === "all" ? "Ticket médio" : `Período: ${periodLabels[scorePeriod]}`}
          trend={getTrend(avgQuotedPriceVariation)}
        />
      </div>
    </MagicBentoGrid>
  );
}
