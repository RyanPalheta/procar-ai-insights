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
    <MagicBentoGrid enableSpotlight spotlightRadius={300} glowColor="228, 0, 43">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          title="Gasto Total"
          value={formatUSD(data.spend)}
          icon={DollarSign}
          variant="default"
          description="Investimento no periodo"
          trend={calcVariation(data.spend, previousData?.spend)}
          info={{
            description: "Total investido nos anuncios da Meta no periodo selecionado.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "a soma de tudo que voce gastou com anuncios na conta da Meta.",
          }}
        />
        <KPICard
          title="Impressoes"
          value={formatNumber(data.impressions)}
          icon={Eye}
          variant="default"
          description="Vezes que os anuncios foram vistos"
          trend={calcVariation(data.impressions, previousData?.impressions)}
          info={{
            description: "Numero de vezes que os anuncios foram exibidos no periodo.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "quantas vezes os anuncios apareceram na tela das pessoas.",
          }}
        />
        <KPICard
          title="Cliques"
          value={formatNumber(data.clicks)}
          icon={MousePointerClick}
          variant="default"
          description="Cliques nos anuncios"
          trend={calcVariation(data.clicks, previousData?.clicks)}
          info={{
            description: "Total de cliques recebidos pelos anuncios no periodo.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "quantas vezes as pessoas clicaram nos anuncios.",
          }}
        />
        <KPICard
          title="Alcance"
          value={formatNumber(data.reach)}
          icon={Users}
          variant="default"
          description="Pessoas unicas alcancadas"
          trend={calcVariation(data.reach, previousData?.reach)}
          info={{
            description: "Pessoas unicas que viram os anuncios pelo menos uma vez.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "quantas pessoas diferentes viram os anuncios (cada pessoa conta uma vez).",
          }}
        />
        <KPICard
          title="CPM"
          value={formatUSD(data.cpm)}
          icon={BarChart3}
          variant={data.cpm <= 15 ? "success" : data.cpm <= 30 ? "warning" : "destructive"}
          description="Custo por mil impressoes"
          trend={calcVariation(data.cpm, previousData?.cpm)}
          info={{
            description: "Custo medio para o anuncio aparecer mil vezes na tela das pessoas.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "o gasto dividido pelo numero de vezes que o anuncio apareceu, vezes 1000.",
          }}
        />
        <KPICard
          title="CPC"
          value={formatUSD(data.cpc)}
          icon={CircleDollarSign}
          variant={data.cpc <= 1 ? "success" : data.cpc <= 3 ? "warning" : "destructive"}
          description="Custo por clique"
          trend={calcVariation(data.cpc, previousData?.cpc)}
          info={{
            description: "Custo medio por clique no anuncio.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "o gasto dividido pelo numero de cliques.",
          }}
        />
        <KPICard
          title="CTR"
          value={`${data.ctr.toFixed(2)}%`}
          icon={Percent}
          variant={data.ctr >= 2 ? "success" : data.ctr >= 1 ? "warning" : "destructive"}
          description="Taxa de cliques"
          trend={calcVariation(data.ctr, previousData?.ctr)}
          info={{
            description: "Percentual de impressoes que geraram cliques.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "o numero de cliques dividido pelo numero de vezes que o anuncio apareceu, vezes 100.",
          }}
        />
        <KPICard
          title="CPL"
          value={data.cpl > 0 ? formatUSD(data.cpl) : "N/A"}
          icon={Target}
          variant={data.cpl > 0 && data.cpl <= 15 ? "success" : data.cpl <= 30 ? "warning" : "default"}
          description="Custo por lead"
          trend={calcVariation(data.cpl, previousData?.cpl)}
          info={{
            description: "Custo medio por lead gerado pelos anuncios.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado. Conta os leads que a Meta registrou.",
            calculation: "o gasto dividido pelo numero de leads que a Meta registrou.",
          }}
        />
        <KPICard
          title="Custo por Compra"
          value={data.costPerPurchase > 0 ? formatUSD(data.costPerPurchase) : "N/A"}
          icon={ShoppingCart}
          variant={data.costPerPurchase > 0 ? "default" : "default"}
          description="Gasto medio por conversao"
          trend={calcVariation(data.costPerPurchase, previousData?.costPerPurchase)}
          info={{
            description: "Quanto custou, em media, cada compra atribuida aos anuncios.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado. Conta as compras atribuidas aos anuncios.",
            calculation: "o gasto dividido pelo numero de compras atribuidas aos anuncios.",
          }}
        />
        <KPICard
          title="ROAS"
          value={data.roas > 0 ? `${data.roas.toFixed(2)}x` : "N/A"}
          icon={TrendingUp}
          variant={data.roas >= 3 ? "success" : data.roas >= 1 ? "warning" : "destructive"}
          description="Retorno sobre gasto"
          trend={calcVariation(data.roas, previousData?.roas)}
          info={{
            description: "Retorno sobre o investimento: receita atribuida por dolar gasto.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado. Usa a receita das compras atribuidas aos anuncios.",
            calculation: "a receita das compras atribuidas aos anuncios dividida pelo gasto.",
          }}
        />
        <KPICard
          title="Compras"
          value={formatNumber(data.purchases)}
          icon={ShoppingBag}
          variant={data.purchases > 0 ? "success" : "default"}
          description="Total de conversoes"
          trend={calcVariation(data.purchases, previousData?.purchases)}
          info={{
            description: "Total de compras atribuidas aos anuncios no periodo.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado. Conta as compras atribuidas aos anuncios.",
            calculation: "quantas compras a Meta atribuiu aos anuncios.",
          }}
        />
        <KPICard
          title="Frequencia"
          value={data.frequency.toFixed(1)}
          icon={Repeat}
          variant={data.frequency <= 3 ? "success" : data.frequency <= 6 ? "warning" : "destructive"}
          description="Media de exibicoes por pessoa"
          trend={calcVariation(data.frequency, previousData?.frequency)}
          info={{
            description: "Media de vezes que cada pessoa viu os anuncios.",
            source: "os numeros vem direto da Meta (Facebook/Instagram), no periodo selecionado.",
            calculation: "o numero de vezes que os anuncios apareceram dividido pelo numero de pessoas diferentes que os viram.",
          }}
        />
        <KPICard
          title="Agendamentos Confirmados"
          value={formatNumber(confirmedAppointments)}
          icon={CalendarCheck}
          variant={confirmedAppointments > 0 ? "success" : "default"}
          description="So conversas de chat · menor que o Kommo"
          info={{
            description: "Clientes que chegaram por conversa de WhatsApp/chat e tiveram agendamento confirmado no periodo, comparados com o gasto de anuncios.",
            source: "conta so os clientes que chegaram por conversa de WhatsApp/chat. Por isso o numero e menor que o total no Kommo. Aqui: os que estao marcados como agendamento confirmado.",
            calculation: "quantos clientes de WhatsApp/chat que chegaram no periodo estao marcados como agendamento confirmado.",
          }}
        />
        <KPICard
          title="Custo por Agendamento"
          value={costPerAppointment > 0 ? formatUSD(costPerAppointment) : "N/A"}
          icon={Receipt}
          variant={costPerAppointment > 0 ? "default" : "default"}
          description="So conversas de chat · menor que o Kommo"
          info={{
            description: "Quanto custou, em media, cada agendamento confirmado (gasto da Meta dividido pelos agendamentos vindos do chat).",
            source: "o gasto vem direto da Meta; os agendamentos contam so os clientes que chegaram por conversa de WhatsApp/chat. Por isso o numero e menor que o total no Kommo. Aqui: os que estao marcados como agendamento confirmado.",
            calculation: "o gasto na Meta dividido pelo numero de clientes de WhatsApp/chat marcados como agendamento confirmado no periodo.",
          }}
        />
        <KPICard
          title="Custo por Financeira"
          value={costPerFinancial > 0 ? formatUSD(costPerFinancial) : "N/A"}
          icon={CreditCard}
          variant={costPerFinancial > 0 ? "default" : "default"}
          description="So conversas de chat · menor que o Kommo"
          info={{
            description: "Quanto custou, em media, cada proposta de financiamento apresentada (gasto da Meta dividido pelas propostas vindas do chat).",
            source: "o gasto vem direto da Meta; as propostas contam so os clientes que chegaram por conversa de WhatsApp/chat. Por isso o numero e menor que o total no Kommo. Aqui: os que receberam proposta de financiamento.",
            calculation: "o gasto na Meta dividido pelo numero de clientes de WhatsApp/chat que receberam proposta de financiamento no periodo.",
          }}
        />
      </div>
    </MagicBentoGrid>
  );
}
