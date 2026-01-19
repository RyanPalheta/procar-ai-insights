import { useState, useEffect } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { TrendingUp, Award, Clock, DollarSign, Receipt, Timer, AlertTriangle, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type ScorePeriod = "all" | "7" | "30" | "90";

const RESPONSE_TIME_THRESHOLD_KEY = "leads_response_time_threshold";
const DEFAULT_THRESHOLD = 60; // 60 minutos

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
  scorePeriod: ScorePeriod;
  onScorePeriodChange: (period: ScorePeriod) => void;
}

const periodLabels: Record<ScorePeriod, string> = {
  "all": "Todos",
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias"
};

// Formata minutos para exibição legível
const formatResponseTime = (minutes: number): string => {
  if (minutes === 0) return "N/A";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) { // menos de 24h
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};

const kpiTooltips = {
  conversionRate: {
    title: "Taxa de Conversão",
    description: "Percentual de leads que foram convertidos em vendas ganhas.",
    comparison: (period: ScorePeriod) => period === "all" 
      ? "Mostrando dados de todo o período" 
      : `Comparando os últimos ${periodLabels[period]} com o período anterior de mesma duração`
  },
  avgScore: {
    title: "Score Médio",
    description: "Média dos scores de qualificação atribuídos pela IA aos leads.",
    comparison: (period: ScorePeriod) => period === "all"
      ? "Mostrando dados de todo o período"
      : `Comparando os últimos ${periodLabels[period]} com o período anterior de mesma duração`
  },
  newLeads24h: {
    title: "Leads Novos (24h)",
    description: "Quantidade de novos leads auditados nas últimas 24 horas.",
    comparison: (_period: ScorePeriod) => "Comparando com as 24 horas anteriores"
  },
  leadsWithQuote: {
    title: "Leads com Cotação",
    description: "Quantidade de leads que possuem um valor de cotação definido.",
    comparison: (period: ScorePeriod) => period === "all"
      ? "Mostrando dados de todo o período"
      : `Comparando os últimos ${periodLabels[period]} com o período anterior de mesma duração`
  },
  avgQuotedPrice: {
    title: "Valor Médio Cotado",
    description: "Ticket médio das cotações realizadas.",
    comparison: (period: ScorePeriod) => period === "all"
      ? "Mostrando dados de todo o período"
      : `Comparando os últimos ${periodLabels[period]} com o período anterior de mesma duração`
  },
  medianFirstResponseTime: {
    title: "Tempo Mediano 1ª Resposta",
    description: "Mediana do tempo entre a 1ª e 3ª interação do lead. A mediana é mais representativa que a média pois não é afetada por casos extremos.",
    comparison: (period: ScorePeriod) => period === "all"
      ? "Mostrando dados de todo o período"
      : `Comparando os últimos ${periodLabels[period]} com o período anterior de mesma duração`
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
  scorePeriod,
  onScorePeriodChange
}: LeadsKPICardsProps) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Carregar threshold do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(RESPONSE_TIME_THRESHOLD_KEY);
    if (saved) {
      const value = parseInt(saved, 10);
      if (!isNaN(value) && value > 0) {
        setThreshold(value);
      }
    }
  }, []);

  // Escutar mudanças no localStorage (para sincronizar com Settings)
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
    // Também verificar periodicamente para mudanças na mesma aba
    const interval = setInterval(handleStorageChange, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Resetar alerta quando o tempo de resposta mudar
  useEffect(() => {
    setAlertDismissed(false);
  }, [medianFirstResponseTime]);

  const isOverThreshold = medianFirstResponseTime > 0 && medianFirstResponseTime > threshold;
  const showAlert = isOverThreshold && !alertDismissed;

  const getTrend = (variation: number | null | undefined, alwaysShow = false, invertColors = false) => {
    if (variation === null || variation === undefined) return undefined;
    if (!alwaysShow && scorePeriod === "all") return undefined;
    return {
      value: Math.abs(parseFloat(variation.toFixed(1))),
      isPositive: invertColors ? variation <= 0 : variation >= 0
    };
  };

  return (
    <div className="space-y-4">
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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Indicadores de Performance</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período:</span>
          <Select value={scorePeriod} onValueChange={(v) => onScorePeriodChange(v as ScorePeriod)}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <TooltipProvider delayDuration={200}>
        <MagicBentoGrid
          enableSpotlight={true}
          spotlightRadius={300}
          glowColor="59, 130, 246"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Taxa de Conversão"
                    value={`${conversionRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    variant={conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "destructive"}
                    description="Leads ganhos vs total"
                    trend={getTrend(conversionRateVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.conversionRate.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.conversionRate.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.conversionRate.comparison(scorePeriod)}</p>
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
                    description={scorePeriod === "all" ? "Todos os leads" : `Últimos ${periodLabels[scorePeriod]}`}
                    trend={getTrend(scoreVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.avgScore.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.avgScore.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.avgScore.comparison(scorePeriod)}</p>
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
                    description="vs. 24h anteriores"
                    trend={getTrend(newLeads24hVariation, true)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.newLeads24h.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.newLeads24h.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.newLeads24h.comparison(scorePeriod)}</p>
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
                    description={scorePeriod === "all" ? "Com preço definido" : `Últimos ${periodLabels[scorePeriod]}`}
                    trend={getTrend(leadsWithQuoteVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.leadsWithQuote.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.leadsWithQuote.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.leadsWithQuote.comparison(scorePeriod)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <KPICard
                    title="Valor Médio Cotado"
                    value={avgQuotedPrice > 0 ? `R$ ${avgQuotedPrice.toFixed(2)}` : "N/A"}
                    icon={DollarSign}
                    variant="success"
                    description={scorePeriod === "all" ? "Ticket médio" : `Últimos ${periodLabels[scorePeriod]}`}
                    trend={getTrend(avgQuotedPriceVariation)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.avgQuotedPrice.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.avgQuotedPrice.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.avgQuotedPrice.comparison(scorePeriod)}</p>
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
                    description={scorePeriod === "all" ? "Entre 1ª e 3ª interação" : `Últimos ${periodLabels[scorePeriod]}`}
                    trend={getTrend(medianFirstResponseTimeVariation, false, true)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-1">
                  <p className="font-medium">{kpiTooltips.medianFirstResponseTime.title}</p>
                  <p className="text-xs text-muted-foreground">{kpiTooltips.medianFirstResponseTime.description}</p>
                  <p className="text-xs text-primary">{kpiTooltips.medianFirstResponseTime.comparison(scorePeriod)}</p>
                  <p className="text-xs mt-1 pt-1 border-t border-border">
                    <span className="font-medium">Limite configurado:</span> {formatResponseTime(threshold)}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </MagicBentoGrid>
      </TooltipProvider>
    </div>
  );
}
