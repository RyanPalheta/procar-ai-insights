import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  BarChart3,
  CircleDollarSign,
  Percent,
  Target,
  ShoppingCart,
  TrendingUp,
  ShoppingBag,
  Repeat,
  CalendarCheck,
  Receipt,
  CreditCard,
} from "lucide-react";
import type { MetaAdsKPIs } from "@/types/meta-ads";
import type { SupabaseMetrics } from "@/hooks/useMetaAdsData";

interface MetaAdsKPICardsProps {
  data: MetaAdsKPIs;
  supabaseMetrics?: SupabaseMetrics;
  previousData?: MetaAdsKPIs;
}

function calcVariation(current: number, previous?: number): { value: number; isPositive: boolean; isNegativeChange: boolean } | undefined {
  if (previous === undefined || previous === 0) return undefined;
  const variation = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(parseFloat(variation.toFixed(1))),
    isPositive: variation >= 0,
    isNegativeChange: variation < 0,
  };
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function MetaAdsKPICards({ data, previousData, supabaseMetrics }: MetaAdsKPICardsProps) {
  const confirmedAppointments = supabaseMetrics?.confirmedAppointments ?? 0;
  const financialPresented = supabaseMetrics?.financialPresented ?? 0;
  const costPerAppointment = confirmedAppointments > 0 ? data.spend / confirmedAppointments : 0;
  const costPerFinancial = financialPresented > 0 ? data.spend / financialPresented : 0;
  return (
    <MagicBentoGrid enableSpotlight spotlightRadius={300} glowColor="59, 130, 246">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          title="Gasto Total"
          value={formatUSD(data.spend)}
          icon={DollarSign}
          variant="default"
          description="Investimento no periodo"
          trend={calcVariation(data.spend, previousData?.spend)}
        />
        <KPICard
          title="Impressoes"
          value={formatNumber(data.impressions)}
          icon={Eye}
          variant="default"
          description="Vezes que os anuncios foram vistos"
          trend={calcVariation(data.impressions, previousData?.impressions)}
        />
        <KPICard
          title="Cliques"
          value={formatNumber(data.clicks)}
          icon={MousePointerClick}
          variant="default"
          description="Cliques nos anuncios"
          trend={calcVariation(data.clicks, previousData?.clicks)}
        />
        <KPICard
          title="Alcance"
          value={formatNumber(data.reach)}
          icon={Users}
          variant="default"
          description="Pessoas unicas alcancadas"
          trend={calcVariation(data.reach, previousData?.reach)}
        />
        <KPICard
          title="CPM"
          value={formatUSD(data.cpm)}
          icon={BarChart3}
          variant={data.cpm <= 15 ? "success" : data.cpm <= 30 ? "warning" : "destructive"}
          description="Custo por mil impressoes"
          trend={calcVariation(data.cpm, previousData?.cpm)}
        />
        <KPICard
          title="CPC"
          value={formatUSD(data.cpc)}
          icon={CircleDollarSign}
          variant={data.cpc <= 1 ? "success" : data.cpc <= 3 ? "warning" : "destructive"}
          description="Custo por clique"
          trend={calcVariation(data.cpc, previousData?.cpc)}
        />
        <KPICard
          title="CTR"
          value={`${data.ctr.toFixed(2)}%`}
          icon={Percent}
          variant={data.ctr >= 2 ? "success" : data.ctr >= 1 ? "warning" : "destructive"}
          description="Taxa de cliques"
          trend={calcVariation(data.ctr, previousData?.ctr)}
        />
        <KPICard
          title="CPL"
          value={data.cpl > 0 ? formatUSD(data.cpl) : "N/A"}
          icon={Target}
          variant={data.cpl > 0 && data.cpl <= 15 ? "success" : data.cpl <= 30 ? "warning" : "default"}
          description="Custo por lead"
          trend={calcVariation(data.cpl, previousData?.cpl)}
        />
        <KPICard
          title="Custo por Compra"
          value={data.costPerPurchase > 0 ? formatUSD(data.costPerPurchase) : "N/A"}
          icon={ShoppingCart}
          variant={data.costPerPurchase > 0 ? "default" : "default"}
          description="Gasto medio por conversao"
          trend={calcVariation(data.costPerPurchase, previousData?.costPerPurchase)}
        />
        <KPICard
          title="ROAS"
          value={data.roas > 0 ? `${data.roas.toFixed(2)}x` : "N/A"}
          icon={TrendingUp}
          variant={data.roas >= 3 ? "success" : data.roas >= 1 ? "warning" : "destructive"}
          description="Retorno sobre gasto"
          trend={calcVariation(data.roas, previousData?.roas)}
        />
        <KPICard
          title="Compras"
          value={formatNumber(data.purchases)}
          icon={ShoppingBag}
          variant={data.purchases > 0 ? "success" : "default"}
          description="Total de conversoes"
          trend={calcVariation(data.purchases, previousData?.purchases)}
        />
        <KPICard
          title="Frequencia"
          value={data.frequency.toFixed(1)}
          icon={Repeat}
          variant={data.frequency <= 3 ? "success" : data.frequency <= 6 ? "warning" : "destructive"}
          description="Media de exibicoes por pessoa"
          trend={calcVariation(data.frequency, previousData?.frequency)}
        />
        <KPICard
          title="Agendamentos Confirmados"
          value={formatNumber(confirmedAppointments)}
          icon={CalendarCheck}
          variant={confirmedAppointments > 0 ? "success" : "default"}
          description="Leads com agendamento confirmado"
        />
        <KPICard
          title="Custo por Agendamento"
          value={costPerAppointment > 0 ? formatUSD(costPerAppointment) : "N/A"}
          icon={Receipt}
          variant={costPerAppointment > 0 ? "default" : "default"}
          description="Gasto / agendamentos confirmados"
        />
        <KPICard
          title="Custo por Financeira"
          value={costPerFinancial > 0 ? formatUSD(costPerFinancial) : "N/A"}
          icon={CreditCard}
          variant={costPerFinancial > 0 ? "default" : "default"}
          description="Gasto / financeiras apresentadas"
        />
      </div>
    </MagicBentoGrid>
  );
}
