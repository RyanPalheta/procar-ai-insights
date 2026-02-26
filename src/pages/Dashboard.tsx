import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, AlertTriangle, Lightbulb, Search, Bell, Download, Gift, Anchor, TrendingUp } from "lucide-react";
import { differenceInHours, parseISO, format, subDays, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";

// Chart Components
import { LeadsKPICards } from "@/components/leads/LeadsKPICards";
import { LeadsChannelChart } from "@/components/leads/LeadsChannelChart";
import { LeadsStatusChart } from "@/components/leads/LeadsStatusChart";
import { LeadsLanguageChart } from "@/components/leads/LeadsLanguageChart";
import { LeadsSentimentChart } from "@/components/leads/LeadsSentimentChart";
import { LeadsTopProductsChart } from "@/components/leads/LeadsTopProductsChart";
import { LeadsTemperatureChart } from "@/components/leads/LeadsTemperatureChart";
import { LeadsTimelineChart } from "@/components/leads/LeadsTimelineChart";
import { LeadsObjectionsChart } from "@/components/leads/LeadsObjectionsChart";
import { LeadsComplianceChart } from "@/components/leads/LeadsComplianceChart";
import { LeadsConversionByResponseTimeChart } from "@/components/leads/LeadsConversionByResponseTimeChart";
import { LeadsConversionByQuoteChart } from "@/components/leads/LeadsConversionByQuoteChart";

// Objection category colors
const objectionCategoryColors: Record<string, { bg: string; border: string; tag: string }> = {
  'preco': { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', tag: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  'tempo': { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', tag: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  'distancia': { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', tag: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'financiamento': { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', tag: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  'confianca': { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', tag: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  'concorrencia': { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', tag: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  'tecnica': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', tag: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
  'indecisao': { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', tag: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300' },
};

const objectionCategoryLabelsMap: Record<string, string> = {
  'preco': 'Preço',
  'tempo': 'Tempo',
  'distancia': 'Distância',
  'financiamento': 'Financiamento',
  'confianca': 'Confiança',
  'concorrencia': 'Concorrência',
  'tecnica': 'Técnica',
  'indecisao': 'Indecisão',
};

// Need type colors based on temperature/urgency
const needTypeColors: Record<string, { bg: string; border: string; tag: string }> = {
  'Quente': { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', tag: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  'Morno': { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', tag: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  'Frio': { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', tag: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
};

export default function Dashboard() {
  // Global Filters State
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Period Controls
  const [scorePeriod, setScorePeriod] = useState<"all" | "7" | "30" | "90">("7");
  const [timelinePeriod, setTimelinePeriod] = useState<"7" | "30" | "90">("30");
  const [channelMode, setChannelMode] = useState<"all" | "closed">("all");

  // Fetch leads
  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_db").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch KPIs via RPC
  const { data: kpisData } = useQuery({
    queryKey: ["leads-kpis", scorePeriod],
    queryFn: async () => {
      const periodDays = scorePeriod === "all" ? null : parseInt(scorePeriod);
      const { data, error } = await supabase.rpc("get_leads_kpis", { 
        period_days: periodDays 
      });
      if (error) throw error;
      return data as {
        total_audited: number;
        total_audited_previous: number | null;
        won_leads: number;
        won_leads_previous: number | null;
        avg_score: number;
        avg_score_previous: number | null;
        new_audited_24h: number;
        new_audited_24h_previous: number | null;
        leads_with_quote: number;
        leads_with_quote_previous: number | null;
        avg_quoted_price: number;
        avg_quoted_price_previous: number | null;
        median_first_response_time_minutes: number;
        median_first_response_time_minutes_previous: number | null;
        walking_leads: number;
        walking_leads_previous: number | null;
      };
    }
  });

  // Channel normalization function
  const normalizeChannel = (channel: string | null): string => {
    if (!channel) return "N/A";
    const lower = channel.toLowerCase();
    if (lower === 'whatsapp') return 'WhatsApp';
    if (lower === 'facebook') return 'Facebook';
    if (lower.includes('instagram')) return 'Instagram';
    return channel;
  };

  // Status normalization function
  const normalizeStatus = (status: string | null): string | null => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    if (["nda", "test", "n/a", "teste"].includes(statusLower)) return null;
    return status;
  };

  // Sentiment normalization function
  const normalizeSentiment = (sentiment: string | null): string | null => {
    if (!sentiment) return null;
    const sentimentLower = sentiment.toLowerCase().trim();
    if (sentimentLower === "n/a" || sentimentLower === "") return null;
    if (sentimentLower.includes("positiv")) return "Positivo";
    if (sentimentLower.includes("neutr")) return "Neutro";
    if (sentimentLower.includes("negativ")) return "Negativo";
    return null;
  };

  // Extract unique values with counts for filters
  const uniqueChannelsWithCount = useMemo(() => {
    const channelCounts = new Map<string, number>();
    leads?.forEach(lead => {
      const channel = normalizeChannel(lead.channel);
      if (channel !== "N/A") {
        channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
      }
    });
    return Array.from(channelCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const uniqueStatusesWithCount = useMemo(() => {
    const statusCounts = new Map<string, number>();
    leads?.forEach(lead => {
      const status = normalizeStatus(lead.sales_status);
      if (status) {
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      }
    });
    return Array.from(statusCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const uniqueLanguagesWithCount = useMemo(() => {
    const languageCounts = new Map<string, number>();
    leads?.forEach(lead => {
      if (lead.lead_language && !["N/A", "NDA"].includes(lead.lead_language)) {
        languageCounts.set(lead.lead_language, (languageCounts.get(lead.lead_language) || 0) + 1);
      }
    });
    return Array.from(languageCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  // Global filtered leads
  const globalFilteredLeads = useMemo(() => {
    return leads?.filter(lead => {
      if (channelFilter !== "all") {
        const normalizedChannel = normalizeChannel(lead.channel);
        if (normalizedChannel !== channelFilter) return false;
      }
      if (statusFilter !== "all") {
        const normalizedStatus = normalizeStatus(lead.sales_status);
        if (normalizedStatus !== statusFilter) return false;
      }
      if (languageFilter !== "all") {
        if (lead.lead_language !== languageFilter) return false;
      }
      if (dateFrom) {
        const createdAt = new Date(lead.created_at);
        if (createdAt < startOfDay(dateFrom)) return false;
      }
      if (dateTo) {
        const createdAt = new Date(lead.created_at);
        if (createdAt > endOfDay(dateTo)) return false;
      }
      return true;
    }) || [];
  }, [leads, channelFilter, statusFilter, languageFilter, dateFrom, dateTo]);

  const hasActiveGlobalFilters = channelFilter !== "all" || statusFilter !== "all" || languageFilter !== "all" || !!dateFrom || !!dateTo;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (channelFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (languageFilter !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [channelFilter, statusFilter, languageFilter, dateFrom, dateTo]);

  const clearGlobalFilters = () => {
    setChannelFilter("all");
    setStatusFilter("all");
    setLanguageFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // KPI Calculations
  const kpiMetrics = useMemo(() => {
    if (hasActiveGlobalFilters) {
      const totalLeads = globalFilteredLeads.length;
      const wonLeads = globalFilteredLeads.filter(l => 
        normalizeStatus(l.sales_status)?.toLowerCase().includes('ganha')
      ).length;
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;
      
      const leadsWithScore = globalFilteredLeads.filter(l => l.lead_score !== null);
      const avgScore = leadsWithScore.length > 0 
        ? leadsWithScore.reduce((sum, l) => sum + (l.lead_score || 0), 0) / leadsWithScore.length 
        : 0;
      
      const newLeads24h = globalFilteredLeads.filter(l => 
        differenceInHours(new Date(), new Date(l.created_at)) <= 24
      ).length;
      
      const leadsWithQuote = globalFilteredLeads.filter(l => l.lead_price && l.lead_price > 0).length;
      
      const quotedLeads = globalFilteredLeads.filter(l => l.lead_price && l.lead_price > 0);
      const avgQuotedPrice = quotedLeads.length > 0
        ? quotedLeads.reduce((sum, l) => sum + (l.lead_price || 0), 0) / quotedLeads.length
        : 0;

      const walkingLeads = globalFilteredLeads.filter(l => l.is_walking === true).length;

      return {
        conversionRate,
        conversionRateVariation: null,
        avgScore,
        scoreVariation: null,
        leadsWithQuoteVariation: null,
        newLeads24h,
        newLeads24hVariation: null,
        leadsWithQuote,
        avgQuotedPrice,
        avgQuotedPriceVariation: null,
        medianFirstResponseTime: 0,
        medianFirstResponseTimeVariation: null,
        walkingLeads,
        walkingLeadsVariation: null
      };
    }

    if (!kpisData) return {
      conversionRate: 0,
      conversionRateVariation: null,
      avgScore: 0,
      scoreVariation: null,
      leadsWithQuoteVariation: null,
      newLeads24h: 0,
      newLeads24hVariation: null,
      leadsWithQuote: 0,
      avgQuotedPrice: 0,
      avgQuotedPriceVariation: null,
      medianFirstResponseTime: 0,
      medianFirstResponseTimeVariation: null,
      walkingLeads: 0,
      walkingLeadsVariation: null
    };

    const conversionRate = kpisData.total_audited > 0 
      ? (kpisData.won_leads / kpisData.total_audited) * 100 
      : 0;

    let conversionRateVariation: number | null = null;
    if (kpisData.total_audited_previous && kpisData.total_audited_previous > 0) {
      const previousConversionRate = (kpisData.won_leads_previous || 0) / kpisData.total_audited_previous * 100;
      if (previousConversionRate > 0) {
        conversionRateVariation = ((conversionRate - previousConversionRate) / previousConversionRate) * 100;
      }
    }

    let scoreVariation: number | null = null;
    if (kpisData.avg_score_previous && kpisData.avg_score_previous > 0) {
      scoreVariation = ((kpisData.avg_score - kpisData.avg_score_previous) / kpisData.avg_score_previous) * 100;
    }

    let leadsWithQuoteVariation: number | null = null;
    if (kpisData.leads_with_quote_previous && kpisData.leads_with_quote_previous > 0) {
      leadsWithQuoteVariation = ((kpisData.leads_with_quote - kpisData.leads_with_quote_previous) / kpisData.leads_with_quote_previous) * 100;
    }

    let newLeads24hVariation: number | null = null;
    if (kpisData.new_audited_24h_previous && kpisData.new_audited_24h_previous > 0) {
      newLeads24hVariation = ((kpisData.new_audited_24h - kpisData.new_audited_24h_previous) / kpisData.new_audited_24h_previous) * 100;
    }

    let avgQuotedPriceVariation: number | null = null;
    if (kpisData.avg_quoted_price_previous && kpisData.avg_quoted_price_previous > 0) {
      avgQuotedPriceVariation = ((kpisData.avg_quoted_price - kpisData.avg_quoted_price_previous) / kpisData.avg_quoted_price_previous) * 100;
    }

    let medianFirstResponseTimeVariation: number | null = null;
    if (kpisData.median_first_response_time_minutes_previous && kpisData.median_first_response_time_minutes_previous > 0) {
      medianFirstResponseTimeVariation = ((kpisData.median_first_response_time_minutes - kpisData.median_first_response_time_minutes_previous) / kpisData.median_first_response_time_minutes_previous) * 100;
    }

    let walkingLeadsVariation: number | null = null;
    if (kpisData.walking_leads_previous && kpisData.walking_leads_previous > 0) {
      walkingLeadsVariation = ((kpisData.walking_leads - kpisData.walking_leads_previous) / kpisData.walking_leads_previous) * 100;
    }

    return {
      conversionRate,
      conversionRateVariation,
      avgScore: kpisData.avg_score,
      scoreVariation,
      leadsWithQuoteVariation,
      newLeads24h: kpisData.new_audited_24h,
      newLeads24hVariation,
      leadsWithQuote: kpisData.leads_with_quote,
      avgQuotedPrice: kpisData.avg_quoted_price,
      avgQuotedPriceVariation,
      medianFirstResponseTime: kpisData.median_first_response_time_minutes,
      medianFirstResponseTimeVariation,
      walkingLeads: kpisData.walking_leads,
      walkingLeadsVariation
    };
  }, [kpisData, globalFilteredLeads, hasActiveGlobalFilters]);

  // Chart Data Calculations
  const chartData = useMemo(() => {
    if (!globalFilteredLeads.length) return {
      channelData: [],
      closedChannelData: [],
      statusData: [],
      languageData: [],
      sentimentData: [],
      topProductsData: [],
      temperatureData: [],
      timelineData: [],
      objectionsData: [],
      complianceData: [],
      avgCompliance: 0,
      totalWithCompliance: 0,
      totalObjections: 0,
      objectionsOvercome: 0,
      objectionsNotOvercome: 0,
      overcomeRate: 0,
      // Sales strategies
      totalWithAgentMessages: 0,
      usedOffer: 0,
      notUsedOffer: 0,
      offerRate: 0,
      usedAnchoring: 0,
      notUsedAnchoring: 0,
      anchoringRate: 0
    };

    // Channel distribution
    const channelCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      const channel = normalizeChannel(l.channel);
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    });
    const channelData = Array.from(channelCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Channel distribution for closed sales
    const closedChannelCounts = new Map<string, number>();
    globalFilteredLeads.filter(l => normalizeStatus(l.sales_status)?.toLowerCase().includes('ganha')).forEach(l => {
      const channel = normalizeChannel(l.channel);
      if (channel !== "N/A") {
        closedChannelCounts.set(channel, (closedChannelCounts.get(channel) || 0) + 1);
      }
    });
    const closedChannelData = Array.from(closedChannelCounts.entries())
      .map(([name, value]) => {
        const totalForChannel = channelCounts.get(name) || 1;
        const conversion = (value / totalForChannel) * 100;
        return { name, value, conversion };
      })
      .sort((a, b) => b.value - a.value);

    // Status distribution
    const statusCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      const normalizedStatus = normalizeStatus(l.sales_status);
      if (normalizedStatus) {
        statusCounts.set(normalizedStatus, (statusCounts.get(normalizedStatus) || 0) + 1);
      }
    });
    const statusData = Array.from(statusCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Language distribution
    const languageCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      if (l.lead_language && l.lead_language !== "N/A" && l.lead_language !== "NDA") {
        languageCounts.set(l.lead_language, (languageCounts.get(l.lead_language) || 0) + 1);
      }
    });
    const languageData = Array.from(languageCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Sentiment distribution
    const sentimentCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      const normalizedSentiment = normalizeSentiment(l.sentiment);
      if (normalizedSentiment) {
        sentimentCounts.set(normalizedSentiment, (sentimentCounts.get(normalizedSentiment) || 0) + 1);
      }
    });
    const sentimentData = Array.from(sentimentCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top 5 products
    const productCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      if (l.service_desired) {
        productCounts.set(l.service_desired, (productCounts.get(l.service_desired) || 0) + 1);
      }
    });
    const topProductsData = Array.from(productCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Temperature distribution
    const temperatureCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      const temp = (l as any).lead_temperature;
      if (temp) {
        const normalizedTemp = temp.charAt(0).toUpperCase() + temp.slice(1).toLowerCase();
        temperatureCounts.set(normalizedTemp, (temperatureCounts.get(normalizedTemp) || 0) + 1);
      }
    });
    const temperatureData = Array.from(temperatureCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const order = ["Quente", "Morno", "Frio"];
        return order.indexOf(a.name) - order.indexOf(b.name);
      });

    // Timeline data
    const periodDays = parseInt(timelinePeriod);
    const timelineCounts = new Map<string, number>();
    const periodStart = subDays(new Date(), periodDays);
    globalFilteredLeads.forEach(l => {
      const leadDate = parseISO(l.created_at);
      if (leadDate >= periodStart) {
        const dateKey = format(leadDate, "dd/MM");
        timelineCounts.set(dateKey, (timelineCounts.get(dateKey) || 0) + 1);
      }
    });
    
    const timelineData: Array<{ date: string; count: number }> = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "dd/MM");
      timelineData.push({
        date: dateKey,
        count: timelineCounts.get(dateKey) || 0
      });
    }

    // Objection categories ranking
    const objectionCategoryLabels: Record<string, string> = {
      'preco': 'Preço/Orçamento',
      'tempo': 'Tempo/Agenda',
      'distancia': 'Localização',
      'financiamento': 'Financiamento',
      'confianca': 'Confiança/Qualidade',
      'concorrencia': 'Concorrência',
      'tecnica': 'Dúvida Técnica',
      'indecisao': 'Indecisão'
    };
    
    const objectionCounts = new Map<string, number>();
    globalFilteredLeads.forEach(l => {
      const categories = (l as any).objection_categories as string[] | null;
      if (categories && categories.length > 0) {
        categories.forEach(cat => {
          objectionCounts.set(cat, (objectionCounts.get(cat) || 0) + 1);
        });
      }
    });
    const objectionsData = Array.from(objectionCounts.entries())
      .map(([key, value]) => ({ 
        name: objectionCategoryLabels[key] || key, 
        value 
      }))
      .sort((a, b) => b.value - a.value);

    // Objection overcome stats
    const leadsWithObjections = globalFilteredLeads.filter(l => l.has_objection === true);
    const objectionsOvercome = leadsWithObjections.filter(l => l.objection_overcome === true).length;
    const objectionsNotOvercome = leadsWithObjections.filter(l => l.objection_overcome === false).length;
    const totalObjections = leadsWithObjections.length;
    const overcomeRate = totalObjections > 0 ? (objectionsOvercome / totalObjections) * 100 : 0;

    // Compliance distribution
    const leadsWithCompliance = globalFilteredLeads.filter(
      l => l.playbook_compliance_score !== null && l.playbook_compliance_score !== undefined
    );
    
    const complianceRanges = {
      excellent: leadsWithCompliance.filter(l => (l.playbook_compliance_score ?? 0) >= 80).length,
      good: leadsWithCompliance.filter(l => (l.playbook_compliance_score ?? 0) >= 60 && (l.playbook_compliance_score ?? 0) < 80).length,
      regular: leadsWithCompliance.filter(l => (l.playbook_compliance_score ?? 0) >= 40 && (l.playbook_compliance_score ?? 0) < 60).length,
      low: leadsWithCompliance.filter(l => (l.playbook_compliance_score ?? 0) < 40).length,
    };
    
    const totalWithCompliance = leadsWithCompliance.length;
    const avgCompliance = totalWithCompliance > 0
      ? leadsWithCompliance.reduce((sum, l) => sum + (l.playbook_compliance_score ?? 0), 0) / totalWithCompliance
      : 0;
    
    const complianceData = [
      { name: "Excelente", value: complianceRanges.excellent, percentage: totalWithCompliance > 0 ? (complianceRanges.excellent / totalWithCompliance) * 100 : 0 },
      { name: "Bom", value: complianceRanges.good, percentage: totalWithCompliance > 0 ? (complianceRanges.good / totalWithCompliance) * 100 : 0 },
      { name: "Regular", value: complianceRanges.regular, percentage: totalWithCompliance > 0 ? (complianceRanges.regular / totalWithCompliance) * 100 : 0 },
      { name: "Baixo", value: complianceRanges.low, percentage: totalWithCompliance > 0 ? (complianceRanges.low / totalWithCompliance) * 100 : 0 },
    ].filter(item => item.value > 0);

    // Sales strategies stats
    const leadsWithAgentMessages = globalFilteredLeads.filter(l => 
      (l as any).used_offer !== null || (l as any).used_anchoring !== null
    );
    const totalWithAgentMessages = leadsWithAgentMessages.length;
    
    const usedOffer = leadsWithAgentMessages.filter(l => (l as any).used_offer === true).length;
    const notUsedOffer = leadsWithAgentMessages.filter(l => (l as any).used_offer === false).length;
    const offerRate = totalWithAgentMessages > 0 ? (usedOffer / totalWithAgentMessages) * 100 : 0;
    
    const usedAnchoring = leadsWithAgentMessages.filter(l => (l as any).used_anchoring === true).length;
    const notUsedAnchoring = leadsWithAgentMessages.filter(l => (l as any).used_anchoring === false).length;
    const anchoringRate = totalWithAgentMessages > 0 ? (usedAnchoring / totalWithAgentMessages) * 100 : 0;

    return {
      channelData,
      closedChannelData,
      statusData,
      languageData,
      sentimentData,
      topProductsData,
      temperatureData,
      timelineData,
      objectionsData,
      complianceData,
      avgCompliance,
      totalWithCompliance,
      // Objection overcome stats
      totalObjections,
      objectionsOvercome,
      objectionsNotOvercome,
      overcomeRate,
      // Sales strategies stats
      totalWithAgentMessages,
      usedOffer,
      notUsedOffer,
      offerRate,
      usedAnchoring,
      notUsedAnchoring,
      anchoringRate
    };
  }, [globalFilteredLeads, timelinePeriod]);

  // Recent objections
  const recentObjections = useMemo(() => {
    return globalFilteredLeads
      ?.filter(lead => lead.has_objection === true && lead.objection_detail)
      .sort((a, b) => new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime())
      .slice(0, 5) || [];
  }, [globalFilteredLeads]);

  // Recent needs
  const recentNeeds = useMemo(() => {
    return globalFilteredLeads
      ?.filter(lead => (lead as any).need_summary)
      .sort((a, b) => new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime())
      .slice(0, 5) || [];
  }, [globalFilteredLeads]);

  // Helper to get objection category from lead
  const getLeadObjectionCategory = (lead: any): string | null => {
    const categories = lead.objection_categories as string[] | null;
    if (categories && categories.length > 0) {
      return categories[0];
    }
    return null;
  };

  // Helper to get temperature
  const getLeadTemperature = (lead: any): string => {
    const temp = lead.lead_temperature;
    if (temp) {
      return temp.charAt(0).toUpperCase() + temp.slice(1).toLowerCase();
    }
    return 'Frio';
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Enhanced Header with Search, Notifications, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground">
            Panorama completo das suas operações comerciais
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Bar (decorative for now) */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 w-[200px] bg-background"
              disabled
            />
          </div>
          {/* Notifications */}
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-medium">
              3
            </span>
          </Button>
          {/* Export Button */}
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {hasActiveGlobalFilters && (
            <span className="text-sm text-muted-foreground">
              Exibindo <span className="font-semibold text-foreground">{globalFilteredLeads.length}</span> de {leads?.length || 0} leads
            </span>
          )}
        </div>
        <CollapsibleContent className="mt-3">
          <Card className="border-dashed">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Channel Filter */}
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Todos os Canais ({leads?.length || 0})</SelectItem>
                    {uniqueChannelsWithCount.map(({ value, count }) => (
                      <SelectItem key={value} value={value}>
                        {value} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[260px] bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Todos os Status ({leads?.length || 0})</SelectItem>
                    {uniqueStatusesWithCount.map(({ value, count }) => (
                      <SelectItem key={value} value={value}>
                        {value} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Language Filter */}
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Língua" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Todas as Línguas ({leads?.length || 0})</SelectItem>
                    {uniqueLanguagesWithCount.map(({ value, count }) => (
                      <SelectItem key={value} value={value}>
                        {value} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date Range Filter */}
                <DateRangeFilter
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                />
                
                {/* Clear Button */}
                {hasActiveGlobalFilters && (
                  <Button variant="ghost" size="sm" onClick={clearGlobalFilters} className="h-9">
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* KPI Cards Section */}
      <LeadsKPICards 
        {...kpiMetrics} 
        scorePeriod={scorePeriod}
        onScorePeriodChange={setScorePeriod}
      />

      {/* Timeline Chart - Full Width */}
      <LeadsTimelineChart 
        data={chartData.timelineData} 
        period={timelinePeriod}
        onPeriodChange={setTimelinePeriod}
      />

      {/* Primary Charts - 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <LeadsChannelChart 
          data={chartData.channelData} 
          closedData={chartData.closedChannelData}
          mode={channelMode}
          onModeChange={setChannelMode}
        />
        <LeadsStatusChart data={chartData.statusData} />
        <LeadsTemperatureChart data={chartData.temperatureData} />
      </div>

      {/* Secondary Charts - 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <LeadsLanguageChart data={chartData.languageData} />
        <LeadsSentimentChart data={chartData.sentimentData} />
        <LeadsTopProductsChart data={chartData.topProductsData} />
      </div>

      {/* Operational Charts - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsObjectionsChart data={chartData.objectionsData} />
        <LeadsComplianceChart 
          data={chartData.complianceData} 
          avgScore={chartData.avgCompliance}
          totalAudited={chartData.totalWithCompliance}
        />
      </div>

      {/* Conversion by Response Time & Quote Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsConversionByResponseTimeChart 
          periodDays={scorePeriod === "all" ? null : parseInt(scorePeriod)} 
        />
        <LeadsConversionByQuoteChart 
          periodDays={scorePeriod === "all" ? null : parseInt(scorePeriod)} 
        />
      </div>

      {/* Objection & Sales Strategy Stats - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objection Overcome Stats */}
        {chartData.totalObjections > 0 && (
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Taxa de Objeções Contornadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {/* Main percentage */}
                <div className="flex flex-col items-center">
                  <span className={`text-4xl font-bold ${chartData.overcomeRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {chartData.overcomeRate.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      ✅ Contornadas: {chartData.objectionsOvercome}
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      ❌ Não Contornadas: {chartData.objectionsNotOvercome}
                    </span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${chartData.overcomeRate}%` }}
                    />
                    <div 
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${100 - chartData.overcomeRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Total de {chartData.totalObjections} leads com objeções registradas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales Strategies Stats */}
        {chartData.totalWithAgentMessages > 0 && (
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Uso de Estratégias de Venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Offers/Promotions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">Ofertas/Promoções</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${chartData.offerRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {chartData.offerRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">✅ {chartData.usedOffer}</span>
                    <span className="text-muted-foreground">❌ {chartData.notUsedOffer}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${chartData.offerRate}%` }}
                    />
                  </div>
                </div>

                {/* Price Anchoring */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Anchor className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Ancoragem de Preço</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${chartData.anchoringRate >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {chartData.anchoringRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600 dark:text-blue-400">✅ {chartData.usedAnchoring}</span>
                    <span className="text-muted-foreground">❌ {chartData.notUsedAnchoring}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${chartData.anchoringRate}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Total de {chartData.totalWithAgentMessages} leads analisados
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Colorful Feeds Section - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Objections Feed with Colors */}
        {recentObjections.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Objeções Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentObjections.map((lead) => {
                const category = getLeadObjectionCategory(lead);
                const colorScheme = category && objectionCategoryColors[category] 
                  ? objectionCategoryColors[category] 
                  : { bg: 'bg-muted/50', border: 'border-border/50', tag: 'bg-muted text-muted-foreground' };
                const categoryLabel = category ? objectionCategoryLabelsMap[category] || category : null;
                const timeAgo = formatDistanceToNow(new Date(lead.last_updated || lead.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                });

                return (
                  <Link
                    key={lead.session_id}
                    to={`/leads/${lead.session_id}`}
                    className={`block p-3 rounded-lg transition-all hover:shadow-md border ${colorScheme.bg} ${colorScheme.border}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {categoryLabel && (
                          <Badge className={`text-xs font-medium ${colorScheme.tag} border-0`}>
                            {categoryLabel}
                          </Badge>
                        )}
                        {lead.objection_overcome !== null && (
                          <Badge 
                            variant={lead.objection_overcome ? "default" : "destructive"} 
                            className={`text-xs font-medium ${lead.objection_overcome 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0' 
                              : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0'}`}
                          >
                            {lead.objection_overcome ? '✅ Contornada' : '❌ Não Contornada'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Lead #{lead.session_id}</span>
                      {lead.lead_intent && (
                        <span className="text-xs text-muted-foreground">• {lead.lead_intent}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 italic">
                      "{lead.objection_detail}"
                    </p>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Needs Feed with Colors */}
        {recentNeeds.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Necessidades Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNeeds.map((lead) => {
                const temperature = getLeadTemperature(lead);
                const colorScheme = needTypeColors[temperature] || needTypeColors['Frio'];
                const timeAgo = formatDistanceToNow(new Date(lead.last_updated || lead.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                });

                return (
                  <Link
                    key={lead.session_id}
                    to={`/leads/${lead.session_id}`}
                    className={`block p-3 rounded-lg transition-all hover:shadow-md border ${colorScheme.bg} ${colorScheme.border}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={`text-xs font-medium ${colorScheme.tag} border-0`}>
                        {temperature}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Lead #{lead.session_id}</span>
                      {lead.service_desired && (
                        <span className="text-xs text-muted-foreground">• {lead.service_desired}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {(lead as any).need_summary}
                    </p>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
