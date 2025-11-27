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
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Sparkles
} from "lucide-react";
import AIAnalysisDialog from "@/components/leads/AIAnalysisDialog";

export default function LeadDetails() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
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
      
      // Refetch todos os dados do lead
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
    // Called when animation completes, can be used for additional logic
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
            className="bg-primary"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            🔍 Analisar Este Lead
          </Button>
          
          <Badge variant={getStatusColor(lead.sales_status) as any} className="text-lg px-4 py-2">
            {lead.sales_status || "N/A"}
          </Badge>
        </div>
      </div>

      {/* Informações principais do lead */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Interações</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interactions?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ligações</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calls?.length || 0}</div>
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
          <div className="grid gap-4 md:grid-cols-2">
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
              <label className="text-sm font-medium text-muted-foreground">Serviço Desejado</label>
              <p className="text-base mt-1">{lead.service_desired || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Idioma</label>
              <p className="text-base mt-1">{lead.lead_language || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Oportunidade de Upsell</label>
              <p className="text-base mt-1">{lead.upsell_opportunity || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Versão IA</label>
              <p className="text-base mt-1">{lead.ai_version || "N/A"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium text-muted-foreground">Ponto de Melhoria</label>
            <p className="text-base mt-1">{lead.improvement_point || "N/A"}</p>
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

      {/* Análise de Playbook */}
      {(lead.playbook_compliance_score !== null || lead.playbook_steps_completed || lead.playbook_steps_missing || lead.playbook_violations) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Análise de Playbook
            </CardTitle>
            {lead.service_desired && (
              <p className="text-sm text-muted-foreground">
                Produto identificado: <Badge variant="secondary">{lead.service_desired}</Badge>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score de Compliance */}
            {lead.playbook_compliance_score !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Score de Compliance</label>
                  <span className="text-2xl font-bold">{lead.playbook_compliance_score}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div 
                    className="bg-primary h-3 rounded-full transition-all" 
                    style={{ width: `${lead.playbook_compliance_score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Etapas Cumpridas */}
            {lead.playbook_steps_completed && lead.playbook_steps_completed.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-success flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  Etapas Cumpridas
                </label>
                <ul className="space-y-1 pl-6">
                  {lead.playbook_steps_completed.map((step, idx) => (
                    <li key={idx} className="text-sm list-disc">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Etapas Faltantes */}
            {lead.playbook_steps_missing && lead.playbook_steps_missing.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-destructive flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4" />
                  Etapas Faltantes
                </label>
                <ul className="space-y-1 pl-6">
                  {lead.playbook_steps_missing.map((step, idx) => (
                    <li key={idx} className="text-sm list-disc">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Violações */}
            {lead.playbook_violations && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-destructive">Violações Identificadas</label>
                <div className="p-3 border border-destructive/50 rounded-md bg-destructive/10">
                  <p className="text-sm">{lead.playbook_violations}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
