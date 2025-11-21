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
import { Eye, Sparkles, Loader2, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzingLeads, setAnalyzingLeads] = useState<Set<number>>(new Set());
  const [processedFilter, setProcessedFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [complianceRange, setComplianceRange] = useState<[number, number]>([0, 100]);
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

    return true;
  });

  const clearFilters = () => {
    setProcessedFilter("all");
    setProductFilter("all");
    setSentimentFilter("all");
    setComplianceRange([0, 100]);
  };

  const hasActiveFilters = 
    processedFilter !== "all" ||
    productFilter !== "all" ||
    sentimentFilter !== "all" ||
    complianceRange[0] !== 0 ||
    complianceRange[1] !== 100;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
        <p className="text-muted-foreground">
          Gerencie e acompanhe todos os seus leads
        </p>
      </div>

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
                Filtros {hasActiveFilters && `(${[processedFilter !== "all", productFilter !== "all", sentimentFilter !== "all", complianceRange[0] !== 0 || complianceRange[1] !== 100].filter(Boolean).length})`}
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
                        </div>
                      </TableCell>
                      <TableCell>{lead.channel || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lead.sales_status) as any}>
                          {lead.sales_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.lead_score || "N/A"}</TableCell>
                      <TableCell>
                        {lead.playbook_compliance_score !== null ? (
                          <span className="font-medium">
                            {lead.playbook_compliance_score}%
                          </span>
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
