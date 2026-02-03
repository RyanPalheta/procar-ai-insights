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
import { Eye, Sparkles, Loader2, Filter, X, Star, Calendar, Flame, Sun, Snowflake, MessageSquare, ClipboardCheck } from "lucide-react";
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

  // Table filter
  const filteredLeads = leads?.filter((lead) => {
    const matchesSearch = 
      lead.session_id?.toString().includes(searchTerm) ||
      lead.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.sales_status?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (processedFilter === "processed" && !lead.processed) return false;
    if (processedFilter === "unprocessed" && lead.processed) return false;

    if (productFilter !== "all" && lead.service_desired !== productFilter) return false;

    if (sentimentFilter !== "all" && lead.sentiment !== sentimentFilter) return false;

    if (temperatureFilter !== "all" && (lead as any).lead_temperature !== temperatureFilter) return false;

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
          <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">
            Gerencie e acompanhe todos os seus leads
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
                Filtros {hasActiveFilters && `(${[processedFilter !== "all", productFilter !== "all", sentimentFilter !== "all", temperatureFilter !== "all", dateFrom !== "", dateTo !== ""].filter(Boolean).length})`}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Buscar por lead ID, canal ou status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            
            <Tabs value={processedFilter} onValueChange={setProcessedFilter} className="w-auto">
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Produto Desejado */}
                <div className="space-y-2">
                  <Label>Produto Desejado</Label>
                  <Select value={productFilter} onValueChange={setProductFilter}>
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
                  <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
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
                  <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
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
                    <TableHead>
                      <span className="flex items-center gap-1">
                        Compliance
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
