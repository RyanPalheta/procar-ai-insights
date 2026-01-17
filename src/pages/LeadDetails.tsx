import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MessageSquare, 
  TrendingUp,
  Calendar,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Sparkles,
  Flame,
  Sun,
  Snowflake,
  Thermometer,
  Target,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Footprints,
  History,
  Bot,
  Globe,
  UserCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AIAnalysisDialog from "@/components/leads/AIAnalysisDialog";

// Mapeamento de nomes de campos para português
const fieldLabels: Record<string, string> = {
  sales_status: "Status de Venda",
  lead_temperature: "Temperatura",
  lead_score: "Score do Lead",
  is_walking: "Lead Presencial",
  sentiment: "Sentimento",
  lead_price: "Valor",
  service_desired: "Serviço Desejado",
  lead_intent: "Intenção",
  has_objection: "Objeção",
  objection_detail: "Detalhe da Objeção",
  need_summary: "Necessidade Principal",
  improvement_point: "Ponto de Melhoria",
  upsell_opportunity: "Oportunidade de Upsell",
  playbook_compliance_score: "Score de Compliance",
  playbook_steps_completed: "Passos Completos",
  playbook_steps_missing: "Passos Faltando",
  playbook_violations: "Violações",
  channel: "Canal",
  sales_person_id: "Vendedor",
  lead_language: "Idioma",
  ai_tags: "Tags IA",
  ai_version: "Versão IA",
  service_rating: "Avaliação",
  processed: "Processado"
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'ai_analysis':
      return <Bot className="h-3 w-3" />;
    case 'api':
      return <Globe className="h-3 w-3" />;
    default:
      return <UserCircle className="h-3 w-3" />;
  }
};

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'ai_analysis':
      return 'IA';
    case 'api':
      return 'API';
    default:
      return 'Manual';
  }
};

const getSourceColor = (source: string) => {
  switch (source) {
    case 'ai_analysis':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    case 'api':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    default:
      return 'bg-green-500/10 text-green-600 border-green-500/30';
  }
};

export default function LeadDetails() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const sessionId = parseInt(leadId || "0");

  // Buscar dados do lead
  const { data: lead, isLoading: loadingLead } = useQuery({
    queryKey: ["lead", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("*")
        .eq("session_id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Buscar interações do lead
  const { data: interactions, isLoading: loadingInteractions } = useQuery({
    queryKey: ["lead-interactions", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interaction_db")
        .select("*")
        .eq("session_id", sessionId)
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Buscar chamadas do lead
  const { data: calls, isLoading: loadingCalls } = useQuery({
    queryKey: ["lead-calls", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_db")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico de alterações do lead
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["lead-history", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_history")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleAnalyzeThisLead = async () => {
    setIsAnalyzing(true);
    setShowAnalysisDialog(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { session_id: sessionId }
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Análise Concluída",
        description: "Lead analisado com sucesso! Atualizando dados..."
      });
      
      queryClient.invalidateQueries({ queryKey: ["lead", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["lead-calls", sessionId] });
      
    } catch (error: any) {
      toast({
        title: "❌ Erro na Análise",
        description: error.message || "Não foi possível analisar o lead",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalysisComplete = () => {
    // Called when animation completes
  };

  const handleUpdateSalesStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase.functions.invoke('update-lead', {
        body: { 
          session_id: sessionId,
          sales_status: newStatus,
          change_source: 'manual'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Status atualizado",
        description: `Status alterado para: ${newStatus}`
      });
      
      queryClient.invalidateQueries({ queryKey: ["lead", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["lead-history", sessionId] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
      case "positivo":
        return <ThumbsUp className="h-4 w-4 text-success" />;
      case "negative":
      case "negativo":
        return <ThumbsDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
      case "ganho":
      case "qualified":
        return "default";
      case "lost":
      case "perdido":
        return "destructive";
      case "in_progress":
      case "em_progresso":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getTemperatureDisplay = (temperature: string | null) => {
    switch (temperature?.toLowerCase()) {
      case "quente":
        return {
          icon: <Flame className="h-4 w-4" />,
          label: "Quente",
          variant: "destructive" as const,
          className: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
        };
      case "morno":
        return {
          icon: <Sun className="h-4 w-4" />,
          label: "Morno",
          variant: "warning" as const,
          className: "bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600"
        };
      case "frio":
        return {
          icon: <Snowflake className="h-4 w-4" />,
          label: "Frio",
          variant: "secondary" as const,
          className: "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
        };
      default:
        return null;
    }
  };

  if (loadingLead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/leads")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Leads
        </Button>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Lead não encontrado
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/leads")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">
            Lead #{lead.session_id}
          </h2>
          <p className="text-muted-foreground">
            Detalhes completos do lead e histórico de interações
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyzeThisLead}
            disabled={isAnalyzing}
            size="lg"
            className="bg-primary rounded-full px-6"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            🔍 Analisar Este Lead
          </Button>
          
          <Select 
            value={lead.sales_status || ''} 
            onValueChange={handleUpdateSalesStatus}
            disabled={isUpdatingStatus}
          >
            <SelectTrigger className="w-[220px] text-lg rounded-full px-4">
              <SelectValue placeholder="Selecione status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aguardando atendimento">Aguardando atendimento</SelectItem>
              <SelectItem value="Contato inicial">Contato inicial</SelectItem>
              <SelectItem value="Tomada de decisão">Tomada de decisão</SelectItem>
              <SelectItem value="Venda ganha">Venda ganha</SelectItem>
              <SelectItem value="Venda perdida">Venda perdida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Informações principais do lead */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temperatura</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(() => {
              const temp = getTemperatureDisplay((lead as any).lead_temperature);
              if (temp) {
                return (
                  <Badge className={`text-base px-3 py-1 ${temp.className}`}>
                    {temp.icon}
                    <span className="ml-1">{temp.label}</span>
                  </Badge>
                );
              }
              return <div className="text-2xl font-bold text-muted-foreground">N/A</div>;
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score do Lead</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lead.lead_score || "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lead.lead_price ? `R$ ${lead.lead_price.toLocaleString('pt-BR')}` : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interações / Chamadas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interactions?.length || 0} / {calls?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes do Lead */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações do Lead
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vendedor</label>
              <p className="text-base mt-1">{lead.sales_person_id || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Canal</label>
              <p className="text-base mt-1">
                <Badge variant="secondary">{lead.channel || "N/A"}</Badge>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Footprints className="h-3 w-3" />
                Lead Presencial (Walking)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={(lead as any).is_walking ? "default" : "outline"}
                  className={(lead as any).is_walking ? "bg-green-500 text-white" : ""}
                >
                  {(lead as any).is_walking ? "Sim - Walking" : "Não"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Serviço Desejado</label>
              <p className="text-base mt-1">{lead.service_desired || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Idioma</label>
              <p className="text-base mt-1">{lead.lead_language || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Intenção
              </label>
              <p className="text-base mt-1">
                <Badge variant="outline" className="bg-primary/10">
                  {(lead as any).lead_intent || "N/A"}
                </Badge>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Objeção
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Checkbox 
                  checked={(lead as any).has_objection || false} 
                  disabled 
                  className="pointer-events-none"
                />
                <span className="text-sm">
                  {(lead as any).has_objection ? (
                    <span className="text-destructive font-medium">Sim</span>
                  ) : (
                    <span className="text-muted-foreground">Não</span>
                  )}
                </span>
              </div>
              {(lead as any).has_objection && (lead as any).objection_detail && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  "{(lead as any).objection_detail}"
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {(lead as any).need_summary && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Necessidade Principal
                </label>
                <p className="text-base mt-1 font-medium text-primary">{(lead as any).need_summary}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Detalhes das Necessidades</label>
              <p className="text-base mt-1 text-muted-foreground">{lead.improvement_point || "N/A"}</p>
            </div>
          </div>

          {lead.sentiment && (
            <>
              <Separator />
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sentimento</label>
                  <div className="flex items-center gap-2 mt-1">
                    {getSentimentIcon(lead.sentiment)}
                    <span className="text-base">{lead.sentiment}</span>
                  </div>
                </div>
                {lead.ai_tags && lead.ai_tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tags IA</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lead.ai_tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <label className="text-muted-foreground">Criado em</label>
              <p className="mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(lead.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            {lead.last_ai_update && (
              <div>
                <label className="text-muted-foreground">Última Análise IA</label>
                <p className="mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(lead.last_ai_update).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
            {lead.last_updated && (
              <div>
                <label className="text-muted-foreground">Última Atualização</label>
                <p className="mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(lead.last_updated).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Interações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Interações ({interactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInteractions ? (
            <div className="text-center py-4">Carregando interações...</div>
          ) : interactions && interactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interactions.map((interaction) => (
                    <TableRow key={interaction.interaction_id}>
                      <TableCell className="text-sm">
                        {new Date(interaction.timestamp).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{interaction.channel || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>{interaction.sender_type || "N/A"}</TableCell>
                      <TableCell className="max-w-md">
                        {interaction.message_text || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma interação registrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Alterações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações ({history?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-center py-4">Carregando histórico...</div>
          ) : history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((record: any) => (
                <div 
                  key={record.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getSourceColor(record.change_source)}`}
                    >
                      {getSourceIcon(record.change_source)}
                      <span className="ml-1">{getSourceLabel(record.change_source)}</span>
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {fieldLabels[record.field_name] || record.field_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground line-through">
                        {record.old_value || "(vazio)"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-foreground">
                        {record.new_value || "(vazio)"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma alteração registrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chamadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Ligações ({calls?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCalls ? (
            <div className="text-center py-4">Carregando ligações...</div>
          ) : calls && calls.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Status Análise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.call_id}>
                      <TableCell className="text-sm">
                        {new Date(call.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{call.type || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        {call.call_duration 
                          ? `${Math.floor(call.call_duration / 60)}:${(call.call_duration % 60).toString().padStart(2, '0')}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>{call.call_result || "N/A"}</TableCell>
                      <TableCell>
                        {call.call_tag && (
                          <Badge variant="secondary">{call.call_tag}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={call.ai_analysis_status === "completed" ? "default" : "secondary"}>
                          {call.ai_analysis_status || "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma ligação registrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Dialog */}
      <AIAnalysisDialog
        open={showAnalysisDialog}
        onOpenChange={setShowAnalysisDialog}
        isAnalyzing={isAnalyzing}
        onComplete={handleAnalysisComplete}
      />
    </div>
  );
}
