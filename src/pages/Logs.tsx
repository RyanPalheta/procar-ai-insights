import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function Logs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Calculate stats
  const stats = {
    success: logs?.filter(log => log.status === 'success').length || 0,
    pending: logs?.filter(log => log.status === 'pending').length || 0,
    error: logs?.filter(log => log.status === 'error').length || 0,
    warning: logs?.filter(log => log.event_type.includes('warning')).length || 0,
  };

  const getLogIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "pending":
        return <Clock className="h-5 w-5 text-primary" />;
      default:
        return <CheckCircle2 className="h-5 w-5" />;
    }
  };

  const getLogVariant = (status: string) => {
    switch (status) {
      case "success":
        return "success";
      case "error":
        return "destructive";
      case "warning":
        return "warning";
      case "pending":
        return "default";
      default:
        return "secondary";
    }
  };

  const getEventTitle = (eventType: string, functionName: string | null) => {
    const titles: Record<string, string> = {
      'ai_analysis_started': 'Análise de IA Iniciada',
      'ai_analysis_completed': 'Análise de IA Concluída',
      'ai_analysis_error': 'Erro na Análise de IA',
      'lead_update': 'Lead Atualizado',
      'lead_update_error': 'Erro ao Atualizar Lead',
      'edge_function_call': 'Chamada de Edge Function',
    };
    
    return titles[eventType] || `${functionName || 'Sistema'} - ${eventType}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Logs do Sistema</h2>
        <p className="text-muted-foreground">
          Histórico de integrações e processamento de IA
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Operações Bem-sucedidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.success}</div>
            <p className="text-xs text-muted-foreground">Total registrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Agora</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.warning}</div>
            <p className="text-xs text-muted-foreground">Total registrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.error}</div>
            <p className="text-xs text-muted-foreground">Total registrado</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 rounded-lg border p-4"
                  >
                    <div className="mt-1">{getLogIcon(log.status)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {getEventTitle(log.event_type, log.function_name)}
                        </p>
                        <Badge variant={getLogVariant(log.status) as any}>
                          {log.status}
                        </Badge>
                        {log.session_id && (
                          <Badge variant="outline" className="text-xs">
                            Lead #{log.session_id}
                          </Badge>
                        )}
                        {log.execution_time_ms && (
                          <Badge variant="outline" className="text-xs">
                            {log.execution_time_ms}ms
                          </Badge>
                        )}
                      </div>
                      {log.event_details && (
                        <p className="text-sm text-muted-foreground">
                          {JSON.stringify(log.event_details, null, 2)}
                        </p>
                      )}
                      {log.error_message && (
                        <p className="text-sm text-destructive">
                          {log.error_message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
