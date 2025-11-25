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
import { Eye, Sparkles, Loader2, Filter, X, Star, Calendar } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsKPICards } from "@/components/leads/LeadsKPICards";
import { LeadsChannelChart } from "@/components/leads/LeadsChannelChart";
import { LeadsStatusChart } from "@/components/leads/LeadsStatusChart";
import { LeadsLanguageChart } from "@/components/leads/LeadsLanguageChart";
import { LeadsSentimentChart } from "@/components/leads/LeadsSentimentChart";
import { LeadsTopProductsChart } from "@/components/leads/LeadsTopProductsChart";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzingLeads, setAnalyzingLeads] = useState<Set<number>>(new Set());
  const [processedFilter, setProcessedFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [complianceRange, setComplianceRange] = useState<[number, number]>([0, 100]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
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

  // KPI Calculations
  const kpiMetrics = useMemo(() => {
    if (!leads) return {
      totalLeads: 0,
      conversionRate: 0,
      avgScore: 0,
      newLeads24h: 0,
      leadsWithQuote: 0,
      avgQuotedPrice: 0
    };

    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => 
      l.sales_status?.toLowerCase() === "won" || 
      l.sales_status?.toLowerCase() === "ganho"
    ).length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    const scoresWithValues = leads.filter(l => l.lead_score !== null);
    const avgScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, l) => sum + (l.lead_score || 0), 0) / scoresWithValues.length
      : 0;

    const newLeads24h = leads.filter(l => differenceInHours(new Date(), new Date(l.created_at)) <= 24).length;

    const leadsWithQuote = leads.filter(l => l.lead_price !== null).length;
    const pricesWithValues = leads.filter(l => l.lead_price !== null);
    const avgQuotedPrice = pricesWithValues.length > 0
      ? pricesWithValues.reduce((sum, l) => sum + (l.lead_price || 0), 0) / pricesWithValues.length
      : 0;

    return {
      totalLeads,
      conversionRate,
      avgScore,
      newLeads24h,
      leadsWithQuote,
      avgQuotedPrice
    };
  }, [leads]);

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
      statusData: [],
      languageData: [],
      sentimentData: [],
      topProductsData: []
    };

    // Channel distribution
    const channelCounts = new Map<string, number>();
    leads.forEach(l => {
      const channel = l.channel || "N/A";
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    });
    const channelData = Array.from(channelCounts.entries())
      .map(([name, value]) => ({ name, value }))
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
      .sort((a, b) => b.value - a.value);

    // Language distribution (excluding N/A)
    const languageCounts = new Map<string, number>();
    leads.forEach(l => {
      if (l.lead_language && l.lead_language !== "N/A") {
        const language = l.lead_language;
        languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      }
    });
    const languageData = Array.from(languageCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Sentiment distribution
    const sentimentCounts = new Map<string, number>();
    leads.forEach(l => {
      const sentiment = l.sentiment || "N/A";
      sentimentCounts.set(sentiment, (sentimentCounts.get(sentiment) || 0) + 1);
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

    return {
      channelData,
      statusData,
      languageData,
      sentimentData,
      topProductsData
    };
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

    // Compliance filter
    if (lead.playbook_compliance_score !== null) {
      const score = lead.playbook_compliance_score;
      if (score < complianceRange[0] || score > complianceRange[1]) return false;
    }

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
    setComplianceRange([0, 100]);
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = 
    processedFilter !== "all" ||
    productFilter !== "all" ||
    sentimentFilter !== "all" ||
    complianceRange[0] !== 0 ||
    complianceRange[1] !== 100 ||
    dateFrom !== "" ||
    dateTo !== "";

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
      <LeadsKPICards {...kpiMetrics} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsChannelChart data={chartData.channelData} />
        <LeadsStatusChart data={chartData.statusData} />
        <LeadsLanguageChart data={chartData.languageData} />
        <LeadsSentimentChart data={chartData.sentimentData} />
        <LeadsTopProductsChart data={chartData.topProductsData} />
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
                Filtros {hasActiveFilters && `(${[processedFilter !== "all", productFilter !== "all", sentimentFilter !== "all", complianceRange[0] !== 0 || complianceRange[1] !== 100, dateFrom !== "", dateTo !== ""].filter(Boolean).length})`}
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

                {/* Compliance Score */}
                <div className="space-y-2">
                  <Label>Compliance Score: {complianceRange[0]}% - {complianceRange[1]}%</Label>
                  <Slider
                    value={complianceRange}
                    onValueChange={(value) => setComplianceRange(value as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-2"
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
          ) : filteredLeads && filteredLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead>Serviço</TableHead>
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
                        <div className="flex items-center gap-2">
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
                        </div>
                      </TableCell>
                      <TableCell>{lead.channel || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lead.sales_status) as any}>
                          {lead.sales_status || "N/A"}
                        </Badge>
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
                        {lead.playbook_compliance_score !== null ? (
                          <Badge variant={getComplianceColor(lead.playbook_compliance_score) as any}>
                            {lead.playbook_compliance_score}%
                          </Badge>
                        ) : (
                          "N/A"
                        )}
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
