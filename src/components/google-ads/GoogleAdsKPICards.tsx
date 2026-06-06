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
          info={{
            description: "Total investido nas campanhas do Google Ads no periodo selecionado.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "a soma de tudo que voce gastou com os anuncios no periodo.",
          }}
        />
        <KPICard
          title="Impressoes"
          value={formatNumber(data.impressions)}
          icon={Eye}
          variant="default"
          description="Vezes que os anuncios foram vistos"
          info={{
            description: "Numero de vezes que os anuncios foram exibidos no periodo.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "a soma de quantas vezes seus anuncios apareceram na tela no periodo.",
          }}
        />
        <KPICard
          title="Cliques"
          value={formatNumber(data.clicks)}
          icon={MousePointerClick}
          variant="default"
          description="Cliques nos anuncios"
          info={{
            description: "Total de cliques recebidos pelos anuncios no periodo.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "a soma de quantos cliques seus anuncios receberam no periodo.",
          }}
        />
        <KPICard
          title="CTR"
          value={`${data.ctr.toFixed(2)}%`}
          icon={Percent}
          variant={data.ctr >= 3 ? "success" : data.ctr >= 1 ? "warning" : "destructive"}
          description="Taxa de cliques"
          info={{
            description: "Percentual de impressoes que geraram cliques.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "os cliques dividido pelas vezes que o anuncio apareceu, vezes 100, no periodo.",
          }}
        />
        <KPICard
          title="CPC"
          value={formatUSD(data.cpc)}
          icon={CircleDollarSign}
          variant={data.cpc <= 2 ? "success" : data.cpc <= 5 ? "warning" : "destructive"}
          description="Custo por clique"
          info={{
            description: "Custo medio por clique no anuncio.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "o total gasto dividido pelo numero de cliques, no periodo.",
          }}
        />
        <KPICard
          title="Conversoes"
          value={formatNumber(Math.round(data.conversions))}
          icon={Target}
          variant={data.conversions > 0 ? "success" : "default"}
          description="Total de conversoes"
          info={{
            description: "Total de conversoes atribuidas aos anuncios no periodo.",
            source: "os numeros vem direto do Google Ads (as conversoes que voce configurou na sua conta), no periodo selecionado.",
            calculation: "a soma das conversoes registradas pelos anuncios no periodo.",
          }}
        />
        <KPICard
          title="ROAS"
          value={data.roas > 0 ? `${data.roas.toFixed(2)}x` : "N/A"}
          icon={TrendingUp}
          variant={data.roas >= 3 ? "success" : data.roas >= 1 ? "warning" : "default"}
          description="Retorno sobre gasto"
          info={{
            description: "Retorno sobre o investimento: valor de conversao por dolar gasto.",
            source: "os numeros vem direto do Google Ads (o valor das conversoes na sua conta), no periodo selecionado.",
            calculation: "o valor gerado pelas conversoes dividido pelo total gasto, no periodo.",
          }}
        />
        <KPICard
          title="Campanhas Ativas"
          value={formatNumber(data.activeCampaigns)}
          icon={LayoutGrid}
          variant="default"
          description="Campanhas com status ativo"
          info={{
            description: "Quantidade de campanhas habilitadas no periodo.",
            source: "os numeros vem direto do Google Ads, no periodo selecionado.",
            calculation: "quantas campanhas diferentes estavam ligadas (ativas) no periodo.",
          }}
        />
      </div>
    </MagicBentoGrid>
  );
}
