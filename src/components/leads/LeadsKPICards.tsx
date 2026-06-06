import { useState, useEffect } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { formatUSD } from "@/lib/utils";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { TrendingUp, Award, Clock, DollarSign, Receipt, Timer, AlertTriangle, X, Footprints, PackagePlus, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const RESPONSE_TIME_THRESHOLD_KEY = "leads_response_time_threshold";
const DEFAULT_THRESHOLD = 60;

// Renders the extra provenance lines (fonte + cálculo) inside an existing
// TooltipContent, below the comparison line.
const TooltipProvenance = ({ fonte, calculo }: { fonte: string; calculo: string }) => (
  <div className="mt-1 pt-1 border-t border-border space-y-0.5">
    <p className="text-[11px] leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">Fonte:</span> {fonte}
    </p>
    <p className="text-[11px] leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">Como é calculado:</span> {calculo}
    </p>
  </div>
);

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
  medianFirstResponseTime: number;
  medianFirstResponseTimeVariation: number | null;
  walkingLeads: number;
  walkingLeadsVariation: number | null;
  upsellLeads: number;
  upsellLeadsVariation: number | null;
  upsellTotalValue: number;
  upsellTotalValueVariation: number | null;
  period: PeriodValue;
  onPeriodChange: (value: PeriodValue) => void;
}

const formatResponseTime = (minutes: number): string => {
  if (minutes === 0) return "N/A";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};

// Fonte comum a todos os indicadores de lead_db: o BI lê o lead_db, que é
// alimentado SÓ por conversas de WhatsApp/chat (Evolution API -> n8n). NÃO há sync
// ativo de todos os leads da Kommo, então NÃO inclui agendamentos Shopmonkey,
// pagamentos, telefone nem entrada manual -> é um SUBCONJUNTO da Kommo.
const LEAD_DB_SOURCE =
  "Lead_db: alimentado só por conversas de WhatsApp/chat (sem sync de toda a Kommo) — é um subconjunto da Kommo, não o total.";

const kpiTooltips = {
  conversionRate: {
    title: "Taxa de Conversão",
    description: "Percentual de leads que foram convertidos em vendas ganhas.",
    fonte: `${LEAD_DB_SOURCE} Aqui: leads auditados pela IA (last_ai_update preenchido).`,
    calculo: "won_leads ÷ total_audited × 100. Ganhos = sales_status contém 'ganha', 'won' ou 'agendamento confirmado'; total = leads auditados (last_ai_update preenchido) no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  avgScore: {
    title: "Score Médio",
    description: "Média dos scores de qualificação atribuídos pela IA aos leads.",
    fonte: `${LEAD_DB_SOURCE} Aqui: leads auditados pela IA (last_ai_update preenchido).`,
    calculo: "AVG(lead_score) dos leads auditados (last_ai_update preenchido) com lead_score definido no período, arredondado a 1 casa.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  newLeads24h: {
    title: "Leads Novos (24h)",
    description: "Quantidade de novos leads auditados nas últimas 24 horas.",
    fonte: `${LEAD_DB_SOURCE} Aqui: todos os leads criados no lead_db (created_at).`,
    calculo: "COUNT de leads com created_at nas últimas 24h. Comparação: COUNT das 24h anteriores (48h a 24h atrás). Janela fixa, ignora o filtro de período.",
    comparison: (_periodLabel: string, _isAll: boolean) => "Comparando com as 24 horas anteriores"
  },
  leadsWithQuote: {
    title: "Leads com Cotação",
    description: "Quantidade de leads que possuem um valor de cotação definido.",
    fonte: `${LEAD_DB_SOURCE} Aqui: auditados pela IA com cotação (lead_price preenchido).`,
    calculo: "COUNT de leads auditados (last_ai_update preenchido) com lead_price preenchido (não nulo) no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  avgQuotedPrice: {
    title: "Valor Médio Cotado",
    description: "Ticket médio das cotações realizadas.",
    fonte: `${LEAD_DB_SOURCE} Aqui: auditados pela IA com cotação (lead_price preenchido).`,
    calculo: "AVG(lead_price) dos leads auditados (last_ai_update preenchido) com lead_price preenchido no período, arredondado a 2 casas.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  medianFirstResponseTime: {
    title: "Tempo Mediano 1ª Resposta",
    description: "Mediana do tempo até a 1ª resposta do vendedor: da 1ª mensagem do cliente até a 1ª resposta do agente. A mediana é mais representativa que a média pois não é afetada por casos extremos.",
    fonte: "Mensagens do interaction_db (WhatsApp/Instagram/Facebook), cruzadas com leads do lead_db (subconjunto de chat da Kommo). Usa o sender_type para distinguir cliente de agente.",
    calculo: "Mediana (PERCENTILE_CONT 0.5) de (1ª mensagem do agente − 1ª mensagem do cliente), em minutos, por sessão; leads filtrados por created_at no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  walkingLeads: {
    title: "Leads Presenciais",
    description: "Quantidade de leads marcados como presenciais (walking), ou seja, clientes que visitaram a loja fisicamente.",
    fonte: `${LEAD_DB_SOURCE} Aqui: auditados pela IA marcados como presenciais (is_walking = true).`,
    calculo: "COUNT de leads auditados (last_ai_update preenchido) com is_walking = true no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  upsellLeads: {
    title: "Oportunidades de Upsell",
    description: "Quantidade de leads onde a IA identificou oportunidade de vender produtos/serviços adicionais.",
    fonte: `${LEAD_DB_SOURCE} Aqui: auditados pela IA com upsell detectado (has_upsell = true).`,
    calculo: "COUNT de leads auditados (last_ai_update preenchido) com has_upsell = true no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  upsellTotalValue: {
    title: "Valor Potencial Upsell",
    description: "Soma dos valores estimados de upsell identificados pela IA nos leads do período.",
    fonte: `${LEAD_DB_SOURCE} Aqui: auditados pela IA com upsell detectado (has_upsell = true).`,
    calculo: "SUM(upsell_value_estimate) dos leads auditados (last_ai_update preenchido) com has_upsell = true no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  }
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
  medianFirstResponseTime,
  medianFirstResponseTimeVariation,
  walkingLeads,
  walkingLeadsVariation,
  upsellLeads,
  upsellLeadsVariation,
  upsellTotalValue,
  upsellTotalValueVariation,
  period,
  onPeriodChange
}: LeadsKPICardsProps) {
  const isAll = period.preset === "all";
  const periodLabel = resolvePeriod(period).label;
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(RESPONSE_TIME_THRESHOLD_KEY);
    if (saved) {
      const value = parseInt(saved, 10);
      if (!isNaN(value) && value > 0) {
        setThreshold(value);
      }
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(RESPONSE_TIME_THRESHOLD_KEY);
      if (saved) {
        const value = parseInt(saved, 10);
        if (!isNaN(value) && value > 0) {
          setThreshold(value);
          setAlertDismissed(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setAlertDismissed(false);
  }, [medianFirstResponseTime]);

  const isOverThreshold = medianFirstResponseTime > 0 && medianFirstResponseTime > threshold;
  const showAlert = isOverThreshold && !alertDismissed;

  const getTrend = (variation: number | null | undefined, alwaysShow = false, invertColors = false) => {
    if (variation === null || variation === undefined) return undefined;
    if (!alwaysShow && isAll) return undefined;
    return {
      value: Math.abs(parseFloat(variation.toFixed(1))),
      isPositive: invertColors ? variation < 0 : variation >= 0,
      isNegativeChange: variation < 0
    };
  };

  return (
    <div className="space-y-3">
      {/* Alert Banner */}
      {showAlert && (
        <Alert className="border-2 border-red-500 bg-red-50 dark:bg-red-950/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertTitle className="flex items-center justify-between text-red-800 dark:text-red-200 font-semibold">
            <span>⚠️ Alerta: Tempo de Resposta Elevado</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 hover:bg-red-200 dark:hover:bg-red-800"
              onClick={() => setAlertDismissed(true)}
            >
              <X className="h-4 w-4 text-red-600 dark:text-red-400" />
            </Button>
          </AlertTitle>
          <AlertDescription className="text-sm text-red-700 dark:text-red-300 font-medium mt-1">
            O tempo mediano de primeira resposta (<strong>{formatResponseTime(medianFirstResponseTime)}</strong>) excedeu o limite configurado de <strong>{formatResponseTime(threshold)}</strong>. 
            Considere revisar os processos de atendimento inicial para melhorar a velocidade de resposta aos leads.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Indicadores de Performance</h3>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>
      
      <TooltipProvider delayDuration={200}>
        <MagicBentoGrid
          enableSpotlight={true}
          spotlightRadius={300}
          glowColor="59, 130, 246"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Taxa de Conversão"
                    value={`${conversionRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    variant={conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "destructive"}
                    description="Ganhos vs auditados (chat) · ≠ Kommo"
                    trend={getTrend(conversionRateVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.conversionRate.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.conversionRate.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.conversionRate.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.conversionRate.fonte} calculo={kpiTooltips.conversionRate.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Score Médio"
                    value={avgScore.toFixed(1)}
                    icon={Award}
                    variant={avgScore >= 7 ? "success" : avgScore >= 5 ? "warning" : "destructive"}
                    description={isAll ? "Auditados (chat) · ≠ Kommo" : periodLabel}
                    trend={getTrend(scoreVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.avgScore.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.avgScore.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.avgScore.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.avgScore.fonte} calculo={kpiTooltips.avgScore.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Leads Novos (24h)"
                    value={newLeads24h}
                    icon={Clock}
                    variant="default"
                    description="Chat (lead_db) · ≠ Kommo"
                    trend={getTrend(newLeads24hVariation, true)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.newLeads24h.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.newLeads24h.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.newLeads24h.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.newLeads24h.fonte} calculo={kpiTooltips.newLeads24h.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Leads com Cotação"
                    value={leadsWithQuote}
                    icon={Receipt}
                    variant="default"
                    description={isAll ? "Auditados c/ preço · ≠ Kommo" : periodLabel}
                    trend={getTrend(leadsWithQuoteVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.leadsWithQuote.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.leadsWithQuote.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.leadsWithQuote.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.leadsWithQuote.fonte} calculo={kpiTooltips.leadsWithQuote.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Valor Médio Cotado"
                    value={avgQuotedPrice > 0 ? formatUSD(avgQuotedPrice) : "N/A"}
                    icon={DollarSign}
                    variant="success"
                    description={isAll ? "Ticket médio · auditados (chat)" : periodLabel}
                    trend={getTrend(avgQuotedPriceVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.avgQuotedPrice.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.avgQuotedPrice.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.avgQuotedPrice.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.avgQuotedPrice.fonte} calculo={kpiTooltips.avgQuotedPrice.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help relative">
                  {isOverThreshold && (
                    <div className="absolute -top-1 -right-1 z-10">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                      </span>
                    </div>
                  )}
                  <KPICard
                    title="Tempo Mediano 1ª Resposta"
                    value={formatResponseTime(medianFirstResponseTime)}
                    icon={Timer}
                    variant={medianFirstResponseTime > 0 && medianFirstResponseTime <= threshold * 0.5 ? "success" : medianFirstResponseTime <= threshold ? "warning" : "destructive"}
                    description={isAll ? "Cliente → 1ª resposta do agente" : periodLabel}
                    trend={getTrend(medianFirstResponseTimeVariation, false, true)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.medianFirstResponseTime.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.medianFirstResponseTime.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.medianFirstResponseTime.comparison(periodLabel, isAll)}</p>
                  <p className="text-xs mt-1 pt-1 border-t border-border">
                    <span className="font-medium">Limite configurado:</span> {formatResponseTime(threshold)}
                  </p>
                  <TooltipProvenance fonte={kpiTooltips.medianFirstResponseTime.fonte} calculo={kpiTooltips.medianFirstResponseTime.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Leads Presenciais"
                    value={walkingLeads}
                    icon={Footprints}
                    variant={walkingLeads > 0 ? "success" : "default"}
                    description={isAll ? "Walking · auditados (chat)" : periodLabel}
                    trend={getTrend(walkingLeadsVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.walkingLeads.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.walkingLeads.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.walkingLeads.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.walkingLeads.fonte} calculo={kpiTooltips.walkingLeads.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Oport. Upsell"
                    value={upsellLeads}
                    icon={PackagePlus}
                    variant={upsellLeads > 0 ? "success" : "default"}
                    description={isAll ? "Upsell · auditados (chat)" : periodLabel}
                    trend={getTrend(upsellLeadsVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.upsellLeads.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.upsellLeads.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.upsellLeads.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.upsellLeads.fonte} calculo={kpiTooltips.upsellLeads.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Valor Upsell"
                    value={upsellTotalValue > 0 ? formatUSD(upsellTotalValue, 0) : "N/A"}
                    icon={BadgeDollarSign}
                    variant={upsellTotalValue > 0 ? "success" : "default"}
                    description={isAll ? "Estimado · auditados (chat)" : periodLabel}
                    trend={getTrend(upsellTotalValueVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.upsellTotalValue.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.upsellTotalValue.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.upsellTotalValue.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.upsellTotalValue.fonte} calculo={kpiTooltips.upsellTotalValue.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </MagicBentoGrid>
      </TooltipProvider>
    </div>
  );
}
