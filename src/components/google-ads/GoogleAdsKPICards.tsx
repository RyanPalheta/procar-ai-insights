import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  CircleDollarSign,
  TrendingUp,
  Target,
  LayoutGrid,
} from "lucide-react";
import type { GoogleAdsKPIs } from "@/types/google-ads";

interface GoogleAdsKPICardsProps {
  data: GoogleAdsKPIs;
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function GoogleAdsKPICards({ data }: GoogleAdsKPICardsProps) {
  return (
    <MagicBentoGrid enableSpotlight spotlightRadius={300} glowColor="234, 179, 8">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <KPICard
          title="Gasto Total"
          value={formatUSD(data.spend)}
          icon={DollarSign}
          variant="default"
          description="Investimento no periodo"
        />
        <KPICard
          title="Impressoes"
          value={formatNumber(data.impressions)}
          icon={Eye}
          variant="default"
          description="Vezes que os anuncios foram vistos"
        />
        <KPICard
          title="Cliques"
          value={formatNumber(data.clicks)}
          icon={MousePointerClick}
          variant="default"
          description="Cliques nos anuncios"
        />
        <KPICard
          title="CTR"
          value={`${data.ctr.toFixed(2)}%`}
          icon={Percent}
          variant={data.ctr >= 3 ? "success" : data.ctr >= 1 ? "warning" : "destructive"}
          description="Taxa de cliques"
        />
        <KPICard
          title="CPC"
          value={formatUSD(data.cpc)}
          icon={CircleDollarSign}
          variant={data.cpc <= 2 ? "success" : data.cpc <= 5 ? "warning" : "destructive"}
          description="Custo por clique"
        />
        <KPICard
          title="Conversoes"
          value={formatNumber(Math.round(data.conversions))}
          icon={Target}
          variant={data.conversions > 0 ? "success" : "default"}
          description="Total de conversoes"
        />
        <KPICard
          title="ROAS"
          value={data.roas > 0 ? `${data.roas.toFixed(2)}x` : "N/A"}
          icon={TrendingUp}
          variant={data.roas >= 3 ? "success" : data.roas >= 1 ? "warning" : "default"}
          description="Retorno sobre gasto"
        />
        <KPICard
          title="Campanhas Ativas"
          value={formatNumber(data.activeCampaigns)}
          icon={LayoutGrid}
          variant="default"
          description="Campanhas com status ativo"
        />
      </div>
    </MagicBentoGrid>
  );
}
