import { KPICard } from "@/components/dashboard/KPICard";
import { Users, TrendingUp, Award, Clock, DollarSign, Receipt } from "lucide-react";

interface LeadsKPICardsProps {
  totalLeads: number;
  conversionRate: number;
  avgScore: number;
  newLeads24h: number;
  leadsWithQuote: number;
  avgQuotedPrice: number;
}

export function LeadsKPICards({
  totalLeads,
  conversionRate,
  avgScore,
  newLeads24h,
  leadsWithQuote,
  avgQuotedPrice
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
      
      <KPICard
        title="Score Médio"
        value={avgScore.toFixed(1)}
        icon={Award}
        variant={avgScore >= 7 ? "success" : avgScore >= 5 ? "warning" : "destructive"}
        description="Qualidade média dos leads"
      />
      
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
