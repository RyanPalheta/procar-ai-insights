import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, AlertTriangle, Lightbulb } from "lucide-react";
import { differenceInHours, parseISO, format, subDays } from "date-fns";

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

export default function Dashboard() {
  // Global Filters State
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  
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
      return true;
    }) || [];
  }, [leads, channelFilter, statusFilter, languageFilter]);

  const hasActiveGlobalFilters = channelFilter !== "all" || statusFilter !== "all" || languageFilter !== "all";

  const clearGlobalFilters = () => {
    setChannelFilter("all");
    setStatusFilter("all");
    setLanguageFilter("all");
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
        medianFirstResponseTimeVariation: null
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
      medianFirstResponseTimeVariation: null
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
      medianFirstResponseTimeVariation
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
      totalWithCompliance: 0
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
      totalWithCompliance
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

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <p className="text-muted-foreground">
          Panorama completo das suas operações comerciais
        </p>
      </div>

      {/* Global Filters Bar */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filtrar por:</span>
            </div>
            
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
            
            {/* Clear Button */}
            {hasActiveGlobalFilters && (
              <Button variant="ghost" size="sm" onClick={clearGlobalFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}

            {/* Active filters indicator */}
            {hasActiveGlobalFilters && (
              <div className="ml-auto text-sm text-muted-foreground">
                Exibindo <span className="font-semibold text-foreground">{globalFilteredLeads.length}</span> de {leads?.length || 0} leads
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Feeds Section - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Objections Feed */}
        {recentObjections.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Objeções Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentObjections.map((lead) => (
                <Link
                  key={lead.session_id}
                  to={`/leads/${lead.session_id}`}
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Lead #{lead.session_id}</span>
                    {lead.lead_intent && (
                      <Badge variant="outline" className="text-xs">
                        {lead.lead_intent}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    "{lead.objection_detail}"
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Needs Feed */}
        {recentNeeds.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Necessidades Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNeeds.map((lead) => (
                <Link
                  key={lead.session_id}
                  to={`/leads/${lead.session_id}`}
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Lead #{lead.session_id}</span>
                    {lead.service_desired && (
                      <Badge variant="outline" className="text-xs">
                        {lead.service_desired}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {(lead as any).need_summary}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
