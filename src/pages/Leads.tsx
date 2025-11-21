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
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzingLeads, setAnalyzingLeads] = useState<Set<number>>(new Set());
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

  const filteredLeads = leads?.filter((lead) =>
    lead.session_id?.toString().includes(searchTerm) ||
    lead.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.sales_status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <CardTitle>Lista de Leads</CardTitle>
          <Input
            placeholder="Buscar por lead ID, canal ou status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
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
                    <TableHead>Serviço</TableHead>
                    <TableHead>Upsell</TableHead>
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
                        {lead.session_id || "N/A"}
                      </TableCell>
                      <TableCell>{lead.channel || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lead.sales_status) as any}>
                          {lead.sales_status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.lead_score || "N/A"}</TableCell>
                      <TableCell>{lead.service_desired || "N/A"}</TableCell>
                      <TableCell>{lead.upsell_opportunity || "N/A"}</TableCell>
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
