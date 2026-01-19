import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, Sparkles, Loader2, Filter, X, Star, Calendar, Flame, Sun, Snowflake, MessageSquare, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInHours, differenceInDays, startOfDay, endOfDay, isWithinInterval, parseISO, format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsKPICards } from "@/components/leads/LeadsKPICards";
import { LeadsChannelChart } from "@/components/leads/LeadsChannelChart";
import { LeadsStatusChart } from "@/components/leads/LeadsStatusChart";
import { LeadsLanguageChart } from "@/components/leads/LeadsLanguageChart";
import { LeadsSentimentChart } from "@/components/leads/LeadsSentimentChart";
import { LeadsTopProductsChart } from "@/components/leads/LeadsTopProductsChart";
import { LeadsTemperatureChart } from "@/components/leads/LeadsTemperatureChart";
import { LeadsTimelineChart } from "@/components/leads/LeadsTimelineChart";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzingLeads, setAnalyzingLeads] = useState<Set<number>>(new Set());
  const [processedFilter, setProcessedFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [timelinePeriod, setTimelinePeriod] = useState<"7" | "30" | "90">("30");
  const [channelMode, setChannelMode] = useState<"all" | "closed">("all");
  const [scorePeriod, setScorePeriod] = useState<"all" | "7" | "30" | "90">("7");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_db").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch interaction counts per lead using the aggregated view
  const { data: interactionCounts } = useQuery({
    queryKey: ["interaction-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_interaction_counts' as never);
      
      // Fallback to direct query if RPC doesn't exist
      if (error) {
        const { data: viewData, error: viewError } = await supabase
          .from("interaction_db")
          .select("session_id");
        
        if (viewError) throw viewError;
        
        const counts: Record<number, number> = {};
        (viewData as { session_id: number | null }[])?.forEach((row) => {
          if (row.session_id) {
            counts[row.session_id] = (counts[row.session_id] || 0) + 1;
          }
        });
        return counts;
      }
      
      // Convert view data to record format
      const counts: Record<number, number> = {};
      (data as { session_id: number; message_count: number }[])?.forEach((row) => {
        if (row.session_id) {
          counts[row.session_id] = row.message_count;
        }
      });
      return counts;
    },
  });

  // Extract unique products and sentiments for filters
  const uniqueProducts = useMemo(() => {
    const products = new Set<string>();
    leads?.forEach(lead => {
      if (lead.service_desired) products.add(lead.service_desired);
    });
    return Array.from(products).sort();
  }, [leads]);

  const uniqueSentiments = useMemo(() => {
    const sentiments = new Set<string>();
    leads?.forEach(lead => {
      if (lead.sentiment) sentiments.add(lead.sentiment);
    });
    return Array.from(sentiments).sort();
  }, [leads]);

  // Channel normalization function (fallback for consistency)
  const normalizeChannel = (channel: string | null): string => {
    if (!channel) return "N/A";
    const lower = channel.toLowerCase();
    if (lower === 'whatsapp') return 'WhatsApp';
    if (lower === 'facebook') return 'Facebook';
    if (lower.includes('instagram')) return 'Instagram';
    return channel;
  };

  // Fetch KPIs via RPC (only AI-audited leads)
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

  // KPI Calculations from RPC data
  const kpiMetrics = useMemo(() => {
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

    // Calcular taxa de conversão do período anterior
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

    // Variação de novos leads 24h (sempre disponível, comparando com 24h anteriores)
    let newLeads24hVariation: number | null = null;
    if (kpisData.new_audited_24h_previous && kpisData.new_audited_24h_previous > 0) {
      newLeads24hVariation = ((kpisData.new_audited_24h - kpisData.new_audited_24h_previous) / kpisData.new_audited_24h_previous) * 100;
    }

    // Variação do preço médio cotado
    let avgQuotedPriceVariation: number | null = null;
    if (kpisData.avg_quoted_price_previous && kpisData.avg_quoted_price_previous > 0) {
      avgQuotedPriceVariation = ((kpisData.avg_quoted_price - kpisData.avg_quoted_price_previous) / kpisData.avg_quoted_price_previous) * 100;
    }

    // Variação do tempo mediano de primeira resposta
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
  }, [kpisData]);

  // Sentiment normalization function
  const normalizeSentiment = (sentiment: string | null): string | null => {
    if (!sentiment) return null;
    const sentimentLower = sentiment.toLowerCase().trim();
    
    // Excluir valores inválidos
    if (sentimentLower === "n/a" || sentimentLower === "") return null;
    
    // Mapeamento para categorias padronizadas
    if (sentimentLower.includes("positiv")) {
      return "Positivo";
    }
    if (sentimentLower.includes("neutr")) {
      return "Neutro";
    }
    if (sentimentLower.includes("negativ")) {
      return "Negativo";
    }
    
    return null; // Retorna null se não foi reconhecido
  };

  // Status normalization function
  const normalizeStatus = (status: string | null): string | null => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    
    // Excluir valores inválidos
    if (["nda", "test"].includes(statusLower)) return null;
    
    // Mapeamento para categorias padronizadas
    if (statusLower.includes("contato inicial") || statusLower.includes("novo lead") || statusLower.includes("dia 1")) {
      return "Novo Lead";
    }
    if (statusLower.includes("qualified") || statusLower.includes("apontamentos") || statusLower.includes("oxigenação")) {
      return "Em Qualificação";
    }
    if (statusLower.includes("negociação") || statusLower.includes("tomada de decisão") || statusLower.includes("dia 2") || statusLower.includes("dia 4")) {
      return "Em Negociação";
    }
    if (statusLower.includes("follow-up") || statusLower.includes("recuperação de clientes")) {
      return "Follow-up";
    }
    if (statusLower.includes("venda ganha") || statusLower.includes("won") || statusLower.includes("ganho")) {
      return "Venda Ganha";
    }
    if (statusLower.includes("venda perdida") || statusLower.includes("lost") || statusLower.includes("perdido") || statusLower.includes("cancelamento")) {
      return "Venda Perdida";
    }
    
    return status; // Retorna o status original se não foi mapeado
  };

  // Chart Data Calculations
  const chartData = useMemo(() => {
    if (!leads) return {
      channelData: [],
      closedChannelData: [],
      statusData: [],
      languageData: [],
      sentimentData: [],
      topProductsData: [],
      temperatureData: [],
      timelineData: []
    };

    // Channel distribution (with normalization)
    const channelCounts = new Map<string, number>();
    leads.forEach(l => {
      const channel = normalizeChannel(l.channel);
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    });
    const channelData = Array.from(channelCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Channel distribution for closed sales only (with conversion rate)
    const closedChannelCounts = new Map<string, number>();
    leads.filter(l => normalizeStatus(l.sales_status) === "Venda Ganha").forEach(l => {
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

    // Status distribution with normalization
    const statusCounts = new Map<string, number>();
    leads.forEach(l => {
      const normalizedStatus = normalizeStatus(l.sales_status);
      if (normalizedStatus) {
        statusCounts.set(normalizedStatus, (statusCounts.get(normalizedStatus) || 0) + 1);
      }
    });
    const statusData = Array.from(statusCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Language distribution (excluding N/A and NDA)
    const languageCounts = new Map<string, number>();
    leads.forEach(l => {
      if (l.lead_language && l.lead_language !== "N/A" && l.lead_language !== "NDA") {
        const language = l.lead_language;
        languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      }
    });
    const languageData = Array.from(languageCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  // Sentiment distribution with normalization
  const sentimentCounts = new Map<string, number>();
  leads.forEach(l => {
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
    leads.forEach(l => {
      if (l.service_desired) {
        const product = l.service_desired;
        productCounts.set(product, (productCounts.get(product) || 0) + 1);
      }
    });
    const topProductsData = Array.from(productCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Temperature distribution
    const temperatureCounts = new Map<string, number>();
    leads.forEach(l => {
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

    // Timeline data - leads by date (dynamic period)
    const periodDays = parseInt(timelinePeriod);
    const timelineCounts = new Map<string, number>();
    const periodStart = subDays(new Date(), periodDays);
    leads.forEach(l => {
      const leadDate = parseISO(l.created_at);
      if (leadDate >= periodStart) {
        const dateKey = format(leadDate, "dd/MM");
        timelineCounts.set(dateKey, (timelineCounts.get(dateKey) || 0) + 1);
      }
    });
    
    // Generate all dates for the period to fill gaps
    const timelineData: Array<{ date: string; count: number }> = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "dd/MM");
      timelineData.push({
        date: dateKey,
        count: timelineCounts.get(dateKey) || 0
      });
    }

    return {
      channelData,
      closedChannelData,
      statusData,
      languageData,
      sentimentData,
      topProductsData,
      temperatureData,
      timelineData
    };
  }, [leads, timelinePeriod]);

  // Recent objections (limit 5)
  const recentObjections = useMemo(() => {
    return leads
      ?.filter(lead => lead.has_objection === true && lead.objection_detail)
      .sort((a, b) => new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime())
      .slice(0, 5) || [];
  }, [leads]);

  // Recent needs (limit 5)
  const recentNeeds = useMemo(() => {
    return leads
      ?.filter(lead => (lead as any).need_summary)
      .sort((a, b) => new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime())
      .slice(0, 5) || [];
  }, [leads]);

  const filteredLeads = leads?.filter((lead) => {
    // Search filter
    const matchesSearch = 
      lead.session_id?.toString().includes(searchTerm) ||
      lead.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.sales_status?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Processed filter
    if (processedFilter === "processed" && !lead.processed) return false;
    if (processedFilter === "unprocessed" && lead.processed) return false;

    // Product filter
    if (productFilter !== "all" && lead.service_desired !== productFilter) return false;

    // Sentiment filter
    if (sentimentFilter !== "all" && lead.sentiment !== sentimentFilter) return false;

    // Temperature filter
    if (temperatureFilter !== "all" && (lead as any).lead_temperature !== temperatureFilter) return false;


    // Date range filter
    if (dateFrom || dateTo) {
      const leadDate = parseISO(lead.created_at);
      
      if (dateFrom && dateTo) {
        const fromDate = startOfDay(parseISO(dateFrom));
        const toDate = endOfDay(parseISO(dateTo));
        if (!isWithinInterval(leadDate, { start: fromDate, end: toDate })) return false;
      } else if (dateFrom) {
        const fromDate = startOfDay(parseISO(dateFrom));
        if (leadDate < fromDate) return false;
      } else if (dateTo) {
        const toDate = endOfDay(parseISO(dateTo));
        if (leadDate > toDate) return false;
      }
    }

    return true;
  });

  const clearFilters = () => {
    setProcessedFilter("all");
    setProductFilter("all");
    setSentimentFilter("all");
    setTemperatureFilter("all");
    
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = 
    processedFilter !== "all" ||
    productFilter !== "all" ||
    sentimentFilter !== "all" ||
    temperatureFilter !== "all" ||
    
    dateFrom !== "" ||
    dateTo !== "";

  const getTemperatureDisplay = (temperature: string | null) => {
    switch (temperature?.toLowerCase()) {
      case "quente":
        return { icon: <Flame className="h-3 w-3" />, label: "Quente", className: "bg-orange-500 text-white border-orange-500" };
      case "morno":
        return { icon: <Sun className="h-3 w-3" />, label: "Morno", className: "bg-yellow-500 text-white border-yellow-500" };
      case "frio":
        return { icon: <Snowflake className="h-3 w-3" />, label: "Frio", className: "bg-blue-500 text-white border-blue-500" };
      default:
        return null;
    }
  };

  // Quick date filters
  const applyQuickDateFilter = (period: "today" | "last7days" | "last30days" | "lastMonth") => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    switch (period) {
      case "today":
        setDateFrom(todayStr);
        setDateTo(todayStr);
        break;
      case "last7days":
        setDateFrom(format(subDays(today, 7), "yyyy-MM-dd"));
        setDateTo(todayStr);
        break;
      case "last30days":
        setDateFrom(format(subDays(today, 30), "yyyy-MM-dd"));
        setDateTo(todayStr);
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        setDateFrom(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setDateTo(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
    }
  };

  const handleAnalyzeLead = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setAnalyzingLeads(prev => new Set(prev).add(sessionId));
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { session_id: sessionId }
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Análise Concluída",
        description: `Lead #${sessionId} analisado com sucesso!`
      });
      
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
    } catch (error: any) {
      toast({
        title: "❌ Erro na Análise",
        description: error.message || "Não foi possível analisar o lead",
        variant: "destructive"
      });
    } finally {
      setAnalyzingLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
      case "ganho":
        return "success";
      case "lost":
      case "perdido":
        return "destructive";
      case "in_progress":
      case "em_progresso":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getComplianceColor = (score: number | null) => {
    if (score === null) return "secondary";
    if (score >= 80) return "success";
    if (score >= 50) return "warning";
    return "destructive";
  };

  const isHighQualityLead = (score: number | null) => {
    return score !== null && score >= 8;
  };

  const isNewLead = (createdAt: string) => {
    const hoursSinceCreation = differenceInHours(new Date(), new Date(createdAt));
    return hoursSinceCreation <= 24;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
        <p className="text-muted-foreground">
          Gerencie e acompanhe todos os seus leads
        </p>
      </div>

      {/* KPI Cards Section */}
      <LeadsKPICards 
        {...kpiMetrics} 
        scorePeriod={scorePeriod}
        onScorePeriodChange={setScorePeriod}
      />

      {/* Timeline Chart */}
      <LeadsTimelineChart 
        data={chartData.timelineData} 
        period={timelinePeriod}
        onPeriodChange={setTimelinePeriod}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <LeadsChannelChart 
          data={chartData.channelData} 
          closedData={chartData.closedChannelData}
          mode={channelMode}
          onModeChange={setChannelMode}
        />
        <LeadsStatusChart data={chartData.statusData} />
        <LeadsTemperatureChart data={chartData.temperatureData} />
        <LeadsLanguageChart data={chartData.languageData} />
        <LeadsSentimentChart data={chartData.sentimentData} />
        <LeadsTopProductsChart data={chartData.topProductsData} />
      </div>

      {/* Recent Objections Feed */}
      {recentObjections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Objeções Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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

      {/* Leads Table Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Lista de Leads</CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar Filtros
                </Button>
              )}
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros {hasActiveFilters && `(${[processedFilter !== "all", productFilter !== "all", sentimentFilter !== "all", temperatureFilter !== "all", dateFrom !== "", dateTo !== ""].filter(Boolean).length})`}
              </Button>
            </div>
          </div>
          
          <Input
            placeholder="Buscar por lead ID, canal ou status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />

          {showFilters && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
              {/* Date Range Filter */}
              <div className="space-y-4 pb-4 border-b">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Filtros Rápidos de Período
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickDateFilter("today")}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickDateFilter("last7days")}
                  >
                    Últimos 7 dias
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickDateFilter("last30days")}
                  >
                    Últimos 30 dias
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickDateFilter("lastMonth")}
                  >
                    Último mês
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Inicial
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    max={dateTo || undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Final
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom || undefined}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status de Análise */}
                <div className="space-y-2">
                  <Label>Status de Análise</Label>
                  <Tabs value={processedFilter} onValueChange={setProcessedFilter}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      <TabsTrigger value="processed">Processados</TabsTrigger>
                      <TabsTrigger value="unprocessed">Pendentes</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Produto Desejado */}
                <div className="space-y-2">
                  <Label>Produto Desejado</Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {uniqueProducts.map(product => (
                        <SelectItem key={product} value={product}>
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sentimento */}
                <div className="space-y-2">
                  <Label>Sentimento</Label>
                  <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os sentimentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os sentimentos</SelectItem>
                      {uniqueSentiments.map(sentiment => (
                        <SelectItem key={sentiment} value={sentiment}>
                          {sentiment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperatura */}
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as temperaturas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="quente">
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" /> Quente
                        </span>
                      </SelectItem>
                      <SelectItem value="morno">
                        <span className="flex items-center gap-1">
                          <Sun className="h-3 w-3 text-yellow-500" /> Morno
                        </span>
                      </SelectItem>
                      <SelectItem value="frio">
                        <span className="flex items-center gap-1">
                          <Snowflake className="h-3 w-3 text-blue-500" /> Frio
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>


              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {filteredLeads?.length || 0} lead(s) encontrado(s)
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : filteredLeads && filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Temp.
                        <Sparkles className="h-3 w-3 text-primary" />
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Score
                        <Sparkles className="h-3 w-3 text-primary" />
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Sentimento
                        <Sparkles className="h-3 w-3 text-primary" />
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Serviço
                        <Sparkles className="h-3 w-3 text-primary" />
                      </span>
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.session_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/leads/${lead.session_id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {lead.session_id || "N/A"}
                          {lead.processed && (
                            <Badge variant="outline" className="text-xs">
                              ✓
                            </Badge>
                          )}
                          {isNewLead(lead.created_at) && (
                            <Badge variant="default" className="text-xs">
                              Novo
                            </Badge>
                          )}
                          {(interactionCounts?.[lead.session_id] || 0) >= 5 && !lead.processed && (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Pronto
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{lead.channel || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lead.sales_status) as any}>
                          {lead.sales_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const temp = getTemperatureDisplay((lead as any).lead_temperature);
                          if (temp) {
                            return (
                              <Badge className={`text-xs ${temp.className}`}>
                                {temp.icon}
                                <span className="ml-1">{temp.label}</span>
                              </Badge>
                            );
                          }
                          return <span className="text-muted-foreground">-</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {lead.lead_score || "N/A"}
                          {isHighQualityLead(lead.lead_score) && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.sentiment ? (
                          <Badge variant="outline">{lead.sentiment}</Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>{lead.service_desired || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleAnalyzeLead(lead.session_id, e)}
                            disabled={analyzingLeads.has(lead.session_id)}
                          >
                            {analyzingLeads.has(lead.session_id) ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                Analisando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Analisar
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/leads/${lead.session_id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
