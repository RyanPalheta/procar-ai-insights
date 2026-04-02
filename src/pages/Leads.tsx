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
import { useNavigate } from "react-router-dom";
import { Eye, Sparkles, Loader2, Filter, X, Star, Calendar, Flame, Sun, Snowflake, MessageSquare, ClipboardCheck, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, AlertTriangle, UserX, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInHours, startOfDay, endOfDay, isWithinInterval, parseISO, format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { KPICard } from "@/components/dashboard/KPICard";

// Normalize channel names for consistent display and filtering
const normalizeChannel = (channel: string | null): string => {
  if (!channel) return "N/A";
  switch (channel.toLowerCase()) {
    case "whatsapp":
      return "WhatsApp";
    case "facebook":
      return "Facebook";
    case "instagram_business":
    case "instagram":
      return "Instagram";
    default:
      return channel;
  }
};

type SortField = "created_at" | "lead_score" | "playbook_compliance_score" | "lead_temperature" | "session_id";
type SortDirection = "asc" | "desc";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzingLeads, setAnalyzingLeads] = useState<Set<number>>(new Set());
  const [processedFilter, setProcessedFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [salesStatusFilter, setSalesStatusFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [complianceRange, setComplianceRange] = useState<[number, number]>([0, 100]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [activeDatePreset, setActiveDatePreset] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [coldAuditFilter, setColdAuditFilter] = useState<string>("all");
  const [reactivationFilter, setReactivationFilter] = useState<string>("all");
  const [followupFilter, setFollowupFilter] = useState<string>("all");
  const pageSize = 30;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch ALL leads using recursive pagination to bypass 1000-row limit
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("lead_db")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);
        if (error) throw error;
        allData.push(...(data || []));
        hasMore = (data?.length || 0) === batchSize;
        from += batchSize;
      }
      return allData;
    },
  });

  // Fetch interaction counts per lead
  const { data: interactionCounts } = useQuery({
    queryKey: ["interaction-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_interaction_counts' as never);
      
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
      
      const counts: Record<number, number> = {};
      (data as { session_id: number; message_count: number }[])?.forEach((row) => {
        if (row.session_id) {
          counts[row.session_id] = row.message_count;
        }
      });
      return counts;
    },
  });

  // Fetch cold audit KPIs
  const { data: coldKpis } = useQuery({
    queryKey: ["cold-audit-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cold_audit_kpis' as never);
      if (error) throw error;
      return data as any;
    },
  });

  // Extract unique values for filter dropdowns
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

  const uniqueChannels = useMemo(() => {
    const channels = new Map<string, number>();
    leads?.forEach(lead => {
      const normalized = normalizeChannel(lead.channel);
      if (normalized !== "N/A") {
        channels.set(normalized, (channels.get(normalized) || 0) + 1);
      }
    });
    return Array.from(channels.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const uniqueSalesStatuses = useMemo(() => {
    const statuses = new Map<string, number>();
    leads?.forEach(lead => {
      if (lead.sales_status) {
        statuses.set(lead.sales_status, (statuses.get(lead.sales_status) || 0) + 1);
      }
    });
    return Array.from(statuses.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const uniqueSellers = useMemo(() => {
    const sellers = new Map<string, number>();
    leads?.forEach(lead => {
      if (lead.sales_person_id) {
        sellers.set(lead.sales_person_id, (sellers.get(lead.sales_person_id) || 0) + 1);
      }
    });
    return Array.from(sellers.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Filter logic
  const filteredLeads = useMemo(() => {
    let result = leads?.filter((lead) => {
      const matchesSearch = 
        lead.session_id?.toString().includes(searchTerm) ||
        lead.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.sales_status?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (processedFilter === "processed" && !lead.processed) return false;
      if (processedFilter === "unprocessed" && lead.processed) return false;

      if (productFilter !== "all" && lead.service_desired !== productFilter) return false;
      if (sentimentFilter !== "all" && lead.sentiment !== sentimentFilter) return false;
      if (temperatureFilter !== "all" && lead.lead_temperature !== temperatureFilter) return false;

      // Channel filter (normalized comparison)
      if (channelFilter !== "all" && normalizeChannel(lead.channel) !== channelFilter) return false;

      // Sales status filter
      if (salesStatusFilter !== "all" && lead.sales_status !== salesStatusFilter) return false;

      // Seller filter
      if (sellerFilter !== "all" && lead.sales_person_id !== sellerFilter) return false;

      // Score range filter
      if (lead.lead_score !== null && lead.lead_score !== undefined) {
        if (lead.lead_score < scoreRange[0] || lead.lead_score > scoreRange[1]) return false;
      } else if (scoreRange[0] > 0) {
        return false; // exclude nulls when min is set above 0
      }

      // Compliance range filter
      if (lead.playbook_compliance_score !== null && lead.playbook_compliance_score !== undefined) {
        if (lead.playbook_compliance_score < complianceRange[0] || lead.playbook_compliance_score > complianceRange[1]) return false;
      } else if (complianceRange[0] > 0) {
        return false;
      }

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

      // Cold audit filters
      if (coldAuditFilter === "cold" && !lead.cold_audit_at) return false;
      if (coldAuditFilter === "normal" && lead.cold_audit_at) return false;

      if (reactivationFilter !== "all" && lead.cold_audit_reactivation_chance !== reactivationFilter) return false;

      if (followupFilter === "ok" && lead.cold_audit_followup_ok !== true) return false;
      if (followupFilter === "nok" && lead.cold_audit_followup_ok !== false) return false;

      return true;
    }) || [];

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "lead_score":
          aVal = a.lead_score ?? -1;
          bVal = b.lead_score ?? -1;
          break;
        case "playbook_compliance_score":
          aVal = a.playbook_compliance_score ?? -1;
          bVal = b.playbook_compliance_score ?? -1;
          break;
        case "lead_temperature": {
          const tempOrder: Record<string, number> = { quente: 3, morno: 2, frio: 1 };
          aVal = tempOrder[a.lead_temperature?.toLowerCase() || ""] ?? 0;
          bVal = tempOrder[b.lead_temperature?.toLowerCase() || ""] ?? 0;
          break;
        }
        case "session_id":
          aVal = a.session_id;
          bVal = b.session_id;
          break;
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, searchTerm, processedFilter, productFilter, sentimentFilter, temperatureFilter, channelFilter, salesStatusFilter, sellerFilter, scoreRange, complianceRange, dateFrom, dateTo, sortField, sortDirection, coldAuditFilter, reactivationFilter, followupFilter]);

  // Pagination
  const totalPages = Math.ceil((filteredLeads?.length || 0) / pageSize);
  const paginatedLeads = filteredLeads?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  const clearFilters = () => {
    setProcessedFilter("all");
    setProductFilter("all");
    setSentimentFilter("all");
    setTemperatureFilter("all");
    setChannelFilter("all");
    setSalesStatusFilter("all");
    setSellerFilter("all");
    setScoreRange([0, 100]);
    setComplianceRange([0, 100]);
    setDateFrom("");
    setDateTo("");
    setActiveDatePreset(null);
    resetPage();
  };

  const activeFilterCount = [
    processedFilter !== "all",
    productFilter !== "all",
    sentimentFilter !== "all",
    temperatureFilter !== "all",
    channelFilter !== "all",
    salesStatusFilter !== "all",
    sellerFilter !== "all",
    scoreRange[0] !== 0 || scoreRange[1] !== 100,
    complianceRange[0] !== 0 || complianceRange[1] !== 100,
    dateFrom !== "",
    dateTo !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

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

  const applyQuickDateFilter = (period: "today" | "last7days" | "last30days" | "lastMonth") => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    setActiveDatePreset(period);
    resetPage();

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    resetPage();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
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

  const isHighQualityLead = (score: number | null) => {
    return score !== null && score >= 8;
  };

  const isNewLead = (createdAt: string) => {
    const hoursSinceCreation = differenceInHours(new Date(), new Date(createdAt));
    return hoursSinceCreation <= 24;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">
            Gerencie e acompanhe todos os seus leads
            {leads && <span className="ml-1">({leads.length} total)</span>}
          </p>
        </div>
      </div>

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
                Filtros {hasActiveFilters && `(${activeFilterCount})`}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Buscar por lead ID, canal ou status..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); resetPage(); }}
              className="max-w-sm"
            />
            
            <Tabs value={processedFilter} onValueChange={(v) => { setProcessedFilter(v); resetPage(); }} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="processed">Prontos</TabsTrigger>
                <TabsTrigger value="unprocessed">Pendentes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
              {/* Date Range Filter */}
              <div className="space-y-4 pb-4 border-b">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Filtros Rápidos de Período
                </Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "today", label: "Hoje" },
                    { key: "last7days", label: "Últimos 7 dias" },
                    { key: "last30days", label: "Últimos 30 dias" },
                    { key: "lastMonth", label: "Último mês" },
                  ] as const).map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={activeDatePreset === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => applyQuickDateFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
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
                    onChange={(e) => { setDateFrom(e.target.value); setActiveDatePreset(null); resetPage(); }}
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
                    onChange={(e) => { setDateTo(e.target.value); setActiveDatePreset(null); resetPage(); }}
                    min={dateFrom || undefined}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Canal */}
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os canais" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">Todos os canais</SelectItem>
                      {uniqueChannels.map(([channel, count]) => (
                        <SelectItem key={channel} value={channel}>
                          {channel} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status de Venda */}
                <div className="space-y-2">
                  <Label>Status de Venda</Label>
                  <Select value={salesStatusFilter} onValueChange={(v) => { setSalesStatusFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">Todos os status</SelectItem>
                      {uniqueSalesStatuses.map(([status, count]) => (
                        <SelectItem key={status} value={status}>
                          {status} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Produto Desejado */}
                <div className="space-y-2">
                  <Label>Produto Desejado</Label>
                  <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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
                  <Select value={sentimentFilter} onValueChange={(v) => { setSentimentFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os sentimentos" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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
                  <Select value={temperatureFilter} onValueChange={(v) => { setTemperatureFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todas as temperaturas" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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

                {/* Vendedor */}
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={sellerFilter} onValueChange={(v) => { setSellerFilter(v); resetPage(); }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Todos os vendedores" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">Todos os vendedores</SelectItem>
                      {uniqueSellers.map(([seller, count]) => (
                        <SelectItem key={seller} value={seller}>
                          {seller} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Score & Compliance Range Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <Label>Score: {scoreRange[0]} — {scoreRange[1]}</Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={scoreRange}
                    onValueChange={(v) => { setScoreRange(v as [number, number]); resetPage(); }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Compliance: {complianceRange[0]}% — {complianceRange[1]}%</Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={complianceRange}
                    onValueChange={(v) => { setComplianceRange(v as [number, number]); resetPage(); }}
                    className="w-full"
                  />
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
          ) : paginatedLeads && paginatedLeads.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("session_id")}>
                          Lead ID
                          <SortIcon field="session_id" />
                        </button>
                      </TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("lead_temperature")}>
                          <span className="flex items-center gap-1">
                            Temp.
                            <Sparkles className="h-3 w-3 text-primary" />
                          </span>
                          <SortIcon field="lead_temperature" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("lead_score")}>
                          <span className="flex items-center gap-1">
                            Score
                            <Sparkles className="h-3 w-3 text-primary" />
                          </span>
                          <SortIcon field="lead_score" />
                        </button>
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
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("playbook_compliance_score")}>
                          <span className="flex items-center gap-1">
                            Compliance
                            <Sparkles className="h-3 w-3 text-primary" />
                          </span>
                          <SortIcon field="playbook_compliance_score" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort("created_at")}>
                          Data
                          <SortIcon field="created_at" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLeads.map((lead) => (
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
                        <TableCell>{normalizeChannel(lead.channel)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(lead.sales_status) as any}>
                            {lead.sales_status || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const temp = getTemperatureDisplay(lead.lead_temperature);
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
                          {lead.playbook_compliance_score !== null ? (
                            <div className="flex items-center gap-1.5">
                              <ClipboardCheck className={`h-4 w-4 ${
                                lead.playbook_compliance_score >= 80 ? 'text-green-500' :
                                lead.playbook_compliance_score >= 50 ? 'text-yellow-500' :
                                'text-red-500'
                              }`} />
                              <span className={`font-medium ${
                                lead.playbook_compliance_score >= 80 ? 'text-green-600' :
                                lead.playbook_compliance_score >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {lead.playbook_compliance_score}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredLeads.length)} de {filteredLeads.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (currentPage <= 4) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || hasActiveFilters ? (
                <div className="space-y-2">
                  <p>Nenhum lead encontrado com os filtros aplicados.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                </div>
              ) : (
                "Nenhum lead cadastrado."
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
