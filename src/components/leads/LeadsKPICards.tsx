import { KPICard } from "@/components/dashboard/KPICard";
import { Users, TrendingUp, Award, Clock, DollarSign, Receipt } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ScorePeriod = "all" | "7" | "30" | "90";

interface LeadsKPICardsProps {
  totalLeads: number;
  conversionRate: number;
  avgScore: number;
  scoreVariation: number | null;
  newLeads24h: number;
  leadsWithQuote: number;
  avgQuotedPrice: number;
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
  totalLeads,
  conversionRate,
  avgScore,
  scoreVariation,
  newLeads24h,
  leadsWithQuote,
  avgQuotedPrice,
  scorePeriod,
  onScorePeriodChange
}: LeadsKPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <KPICard
        title="Total de Leads"
        value={totalLeads}
        icon={Users}
        variant="default"
        description="Total acumulado"
      />
      
      <KPICard
        title="Taxa de Conversão"
        value={`${conversionRate.toFixed(1)}%`}
        icon={TrendingUp}
        variant={conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "destructive"}
        description="Leads ganhos vs total"
      />
      
      <div className="relative">
        <KPICard
          title="Score Médio"
          value={avgScore.toFixed(1)}
          icon={Award}
          variant={avgScore >= 7 ? "success" : avgScore >= 5 ? "warning" : "destructive"}
          description={scorePeriod === "all" ? "Período: Todos" : `Período: ${periodLabels[scorePeriod]}`}
          trend={scoreVariation !== null && scorePeriod !== "all" ? {
            value: Math.abs(parseFloat(scoreVariation.toFixed(1))),
            isPositive: scoreVariation >= 0
          } : undefined}
        />
        <div className="absolute top-3 right-3">
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
        description="Criados recentemente"
      />
      
      <KPICard
        title="Leads com Cotação"
        value={leadsWithQuote}
        icon={Receipt}
        variant="default"
        description="Com preço definido"
      />
      
      <KPICard
        title="Valor Médio Cotado"
        value={avgQuotedPrice > 0 ? `R$ ${avgQuotedPrice.toFixed(2)}` : "N/A"}
        icon={DollarSign}
        variant="success"
        description="Ticket médio"
      />
    </div>
  );
}
