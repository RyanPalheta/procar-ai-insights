import { useState, useEffect } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { formatUSD } from "@/lib/utils";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { TrendingUp, Award, Clock, DollarSign, Receipt, Timer, AlertTriangle, X, Footprints, PackagePlus, BadgeDollarSign, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { format } from "date-fns";
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
      <span className="font-medium text-foreground">De onde vem:</span> {fonte}
    </p>
    <p className="text-[11px] leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">Como contamos:</span> {calculo}
    </p>
  </div>
);

interface LeadsKPICardsProps {
  saleConversionRate: number;
  saleConversionRateVariation: number | null;
  appointmentConversionRate: number;
  appointmentConversionRateVariation: number | null;
  appointmentLeadsCount: number;
  totalLeadsCount: number;
  noShowLeads: number;
  avgScore: number;
  scoreVariation: number | null;
  leadsWithQuoteVariation: number | null;
  newLeads24h: number;
  newLeads24hVariation: number | null;
  /** variação do total de leads do período vs período anterior (p/ o card dinâmico) */
  totalLeadsVariation?: number | null;
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
  "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo.";

const kpiTooltips = {
  saleConversion: {
    title: "Conversão de Venda",
    description: "De cada 100 leads, quantos viraram VENDA — orçamento pago na loja.",
    fonte: "vendas = orçamentos do ShopMonkey que foram PAGOS no período (a fonte real da loja, pela data do pagamento); leads = base do painel (= Kommo).",
    calculo: "orçamentos pagos no período divididos pelo total de leads do período, vezes 100.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  appointmentConversion: {
    title: "Conversão de Agendamento",
    description: "Quantos agendamentos a loja marcou no ShopMonkey em relação aos leads do período.",
    fonte: "Agendamentos = ShopMonkey (agendamento green, fonte real da loja), pela data do agendamento. Leads = base do painel (= Kommo). No-show = agendamentos VERMELHOS no ShopMonkey (faltou/cancelou), mostrado separado no cartão.",
    calculo: "Fórmula: (Agendamentos do ShopMonkey ÷ Total de leads do período) × 100. No-show conta os agendamentos vermelhos do ShopMonkey no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  avgScore: {
    title: "Score Médio",
    description: "A nota média de qualidade que a IA dá aos clientes (de 0 a 10). Quanto maior, mais quente é o cliente.",
    fonte: `${LEAD_DB_SOURCE} Neste cartão: só os clientes que a IA já analisou e deu nota.`,
    calculo: "a média das notas que a IA deu aos clientes analisados no período.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  newLeads24h: {
    title: "Leads Novos",
    description: "Quantos clientes novos chegaram no período selecionado no filtro (dias-calendário no horário da loja).",
    fonte: "base do painel (= Kommo, espelho + chat, sem duplicatas). Dia-calendário no fuso da loja (America/New_York) — a mesma régua da Kommo.",
    calculo: "conta os clientes criados dentro do período do filtro, comparados com a janela imediatamente anterior de mesma duração.",
    comparison: (_periodLabel: string, _isAll: boolean) => "Acompanha o filtro de período"
  },
  leadsWithQuote: {
    title: "Leads com Cotação",
    description: "Quantos orçamentos (cotações) a loja abriu no período.",
    fonte: "vem dos orçamentos do ShopMonkey (a fonte real da loja): todo pedido nasce como orçamento e vira venda quando é pago. Mesma fonte dos orçamentos da aba Vendedores. Não depende do chat/IA.",
    calculo: "conta os orçamentos criados no ShopMonkey no período (sem os arquivados).",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  avgQuotedPrice: {
    title: "Valor Médio Cotado",
    description: "O valor médio dos orçamentos passados aos clientes (ticket médio).",
    fonte: "vem dos orçamentos do ShopMonkey (a fonte real da loja). Não depende do chat/IA.",
    calculo: "a média do valor total dos orçamentos criados no período (só os com valor maior que zero).",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  medianFirstResponseTime: {
    title: "Tempo Mediano 1ª Resposta",
    description: "Quanto tempo o cliente costuma esperar pela primeira resposta — da primeira mensagem dele até a primeira resposta da equipe, contando só o horário de atendimento (9h às 20h, horário da loja). Usamos o valor do meio (mediana), que não é distorcido por casos muito fora da curva.",
    fonte: "vem das mensagens trocadas no WhatsApp, Instagram e Facebook, ligadas aos clientes que chegaram por conversa. A gente identifica nas mensagens quem é o cliente e quem é a equipe.",
    calculo: "para cada conversa, medimos os minutos entre a primeira mensagem do cliente e a primeira resposta da equipe, contando só o que passou dentro do horário de atendimento (9h–20h, fuso da loja) — quem escreve de madrugada começa a contar às 9h; mostramos o valor do meio (mediana) de todos esses tempos.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  walkingLeads: {
    title: "Leads Presenciais",
    description: "Quantos clientes vieram à loja pessoalmente (walk-in).",
    fonte: "vem dos agendamentos do ShopMonkey (a fonte real da loja): a nota do agendamento marca quando foi um walk-in. Não depende do chat/IA.",
    calculo: "conta os agendamentos do ShopMonkey marcados como walk-in (presencial) cuja data do agendamento cai no período selecionado.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  upsellLeads: {
    title: "Oportunidades de Upsell",
    description: "Quantos clientes têm chance de comprar algo a mais: a IA identificou oportunidade de vender produtos ou serviços extras.",
    fonte: `${LEAD_DB_SOURCE} Neste cartão: clientes analisados pela IA em que apareceu chance de venda extra.`,
    calculo: "conta os clientes do período em que a IA viu oportunidade de vender algo a mais.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  },
  upsellTotalValue: {
    title: "Valor Potencial Upsell",
    description: "A soma do valor estimado de tudo que dá para vender a mais para esses clientes.",
    fonte: `${LEAD_DB_SOURCE} Neste cartão: clientes analisados pela IA em que apareceu chance de venda extra.`,
    calculo: "soma do valor estimado de venda extra de todos os clientes do período com essa oportunidade.",
    comparison: (periodLabel: string, isAll: boolean) => isAll
      ? "Mostrando dados de todo o período"
      : `Comparando ${periodLabel} com o período anterior de mesma duração`
  }
};

export function LeadsKPICards({
  saleConversionRate,
  saleConversionRateVariation,
  appointmentConversionRate,
  appointmentConversionRateVariation,
  appointmentLeadsCount,
  totalLeadsCount,
  noShowLeads,
  avgScore,
  scoreVariation,
  leadsWithQuoteVariation,
  newLeads24h,
  newLeads24hVariation,
  totalLeadsVariation = null,
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

  // Card "Leads Novos" acompanha o filtro de período: Hoje → dia atual vs ontem;
  // 7/30/90 → total do período vs janela anterior; personalizado → "de X a Y".
  const newLeadsCard = (() => {
    const resolved = resolvePeriod(period);
    switch (period.preset) {
      case "today":
        return {
          title: "Leads Novos Hoje",
          value: newLeads24h,
          description: "00:00–23:59 de hoje (horário da loja) · vs ontem",
          trend: getTrend(newLeads24hVariation, true),
          comparison: "Comparando com ontem (dia completo)",
          calculo: "conta os clientes criados de 00:00 a 23:59 de hoje (horário da loja), comparados com ONTEM (dia completo).",
        };
      case "yesterday":
        return {
          title: "Leads Novos Ontem",
          value: totalLeadsCount,
          description: "00:00–23:59 de ontem (horário da loja) · vs dia anterior",
          trend: getTrend(totalLeadsVariation, true),
          comparison: "Comparando ontem com o dia anterior (dias completos)",
          calculo: "conta os clientes criados de 00:00 a 23:59 de ontem (horário da loja), comparados com o dia anterior.",
        };
      case "7":
      case "30":
      case "90":
        return {
          title: `Leads Novos em ${period.preset} Dias`,
          value: totalLeadsCount,
          description: `${resolved.label.toLowerCase()} · vs ${period.preset} dias anteriores`,
          trend: getTrend(totalLeadsVariation, true),
          comparison: `Comparando ${resolved.label.toLowerCase()} com os ${period.preset} dias anteriores`,
          calculo: `conta os clientes criados nos ${period.preset} dias do período (dias-calendário no horário da loja), comparados com a janela anterior de mesma duração.`,
        };
      case "all":
        return {
          title: "Leads Novos (Total)",
          value: totalLeadsCount,
          description: "todo o período",
          trend: undefined,
          comparison: "Mostrando dados de todo o período",
          calculo: "conta todos os clientes da base do painel, sem recorte de período.",
        };
      case "custom": {
        const desc = resolved.from && resolved.to
          ? `de ${format(resolved.from, "dd/MM/yyyy")} a ${format(resolved.to, "dd/MM/yyyy")}`
          : resolved.label;
        return {
          title: "Leads Novos no Período",
          value: totalLeadsCount,
          description: desc,
          trend: getTrend(totalLeadsVariation, true),
          comparison: `Comparando ${desc} com o período anterior de mesma duração`,
          calculo: "conta os clientes criados dentro do intervalo escolhido (dias-calendário no horário da loja), comparados com a janela anterior de mesma duração.",
        };
      }
    }
  })();

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
          glowColor="228, 0, 43"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-10 gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Conversão de Venda"
                    value={`${saleConversionRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    variant={saleConversionRate >= 20 ? "success" : saleConversionRate >= 10 ? "warning" : "destructive"}
                    description="Vendas ganhas ÷ total de leads (base completa)"
                    trend={getTrend(saleConversionRateVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.saleConversion.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.saleConversion.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.saleConversion.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.saleConversion.fonte} calculo={kpiTooltips.saleConversion.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Conversão de Agendamento"
                    value={`${appointmentConversionRate.toFixed(1)}%`}
                    icon={CalendarCheck}
                    variant={appointmentConversionRate >= 10 ? "success" : appointmentConversionRate >= 5 ? "warning" : "default"}
                    description={`(${appointmentLeadsCount} agend. ShopMonkey ÷ ${totalLeadsCount} leads) × 100 · ${noShowLeads} no-show`}
                    trend={getTrend(appointmentConversionRateVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.appointmentConversion.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.appointmentConversion.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.appointmentConversion.comparison(periodLabel, isAll)}</p>
                  <TooltipProvenance fonte={kpiTooltips.appointmentConversion.fonte} calculo={kpiTooltips.appointmentConversion.calculo} />
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
                    description={isAll ? "Analisados pela IA (WhatsApp/chat)" : periodLabel}
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
                    title={newLeadsCard.title}
                    value={newLeadsCard.value}
                    icon={Clock}
                    variant="default"
                    description={newLeadsCard.description}
                    trend={newLeadsCard.trend}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{newLeadsCard.title}</p>
                  <p className="text-xs text-muted-foreground">Quantos clientes novos chegaram no período selecionado no filtro (dias-calendário no horário da loja).</p>
                  <p className="text-xs text-primary">{newLeadsCard.comparison}</p>
                  <TooltipProvenance fonte={kpiTooltips.newLeads24h.fonte} calculo={newLeadsCard.calculo} />
                </div>
              </TooltipContent>
            </Tooltip>
            
            {/* Cards "Leads com Cotação" e "Valor Médio Cotado" ocultos da UX a pedido (23/06/2026).
                Lógica e props mantidas (não deletar) — só removidos do render. */}

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
                    description={isAll ? "Do cliente até a 1ª resposta da equipe" : periodLabel}
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
                    description={isAll ? "Walk-in (ShopMonkey)" : periodLabel}
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

            {/* Cards "Oport. Upsell" e "Valor Upsell" desativados da UX a pedido (23/06/2026).
                Lógica e props mantidas — só removidos do render. */}
          </div>
        </MagicBentoGrid>
      </TooltipProvider>
    </div>
  );
}
