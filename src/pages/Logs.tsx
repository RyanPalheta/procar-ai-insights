import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

// Mock data for demonstration
const mockLogs = [
  {
    id: 1,
    timestamp: new Date(),
    type: "success",
    message: "Integração Kommo CRM executada com sucesso",
    details: "45 leads sincronizados",
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 300000),
    type: "processing",
    message: "Análise de IA em andamento",
    details: "12 interações sendo processadas",
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 600000),
    type: "warning",
    message: "Taxa de resposta baixa detectada",
    details: "Canal WhatsApp - 15% abaixo da média",
  },
  {
    id: 4,
    timestamp: new Date(Date.now() - 900000),
    type: "error",
    message: "Falha na conexão VOIP",
    details: "Tentativa de reconexão em 5 minutos",
  },
  {
    id: 5,
    timestamp: new Date(Date.now() - 1200000),
    type: "success",
    message: "Backup de dados concluído",
    details: "Todos os registros salvos com segurança",
  },
];

export default function Logs() {
  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "processing":
        return <Clock className="h-5 w-5 text-primary" />;
      default:
        return <CheckCircle2 className="h-5 w-5" />;
    }
  };

  const getLogVariant = (type: string) => {
    switch (type) {
      case "success":
        return "success";
      case "error":
        return "destructive";
      case "warning":
        return "warning";
      default:
        return "secondary";
    }
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
            <div className="text-2xl font-bold text-success">156</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">12</div>
            <p className="text-xs text-muted-foreground">Agora</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">3</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">1</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {mockLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className="mt-1">{getLogIcon(log.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{log.message}</p>
                      <Badge variant={getLogVariant(log.type) as any}>
                        {log.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
