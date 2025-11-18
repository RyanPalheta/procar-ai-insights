import { useQuery } from "@tanstack/react-query";
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
import { MessageSquare, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export default function Interactions() {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ["interactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interaction_db")
        .select(`
          *,
          lead:lead_db!interaction_db_session_id_fkey(
            sentiment,
            ai_tags,
            processed
          )
        `)
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
      case "positivo":
        return "success";
      case "negative":
      case "negativo":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Calculate sentiment distribution from lead data
  const sentimentData = interactions?.reduce(
    (acc: any, int) => {
      const sentiment = int.lead?.sentiment?.toLowerCase() || "neutro";
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Interações</h2>
        <p className="text-muted-foreground">
          Análise de mensagens e interações com clientes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total de Interações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interactions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Positivas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {sentimentData?.positive || sentimentData?.positivo || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Negativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {sentimentData?.negative || sentimentData?.negativo || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Processadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interactions?.filter((i) => i.lead?.processed).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Interações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : interactions && interactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead>Tags IA</TableHead>
                    <TableHead>Processado</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interactions.map((interaction) => (
                    <TableRow key={interaction.interaction_id}>
                      <TableCell>
                        <Badge variant="secondary">{interaction.channel || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>{interaction.sender_type || "N/A"}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {interaction.message_text || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(interaction.lead?.sentiment)}
                          <Badge variant={getSentimentColor(interaction.lead?.sentiment) as any}>
                            {interaction.lead?.sentiment || "N/A"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {interaction.lead?.ai_tags?.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          )) || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={interaction.lead?.processed ? "success" : "secondary"}>
                          {interaction.lead?.processed ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(interaction.timestamp).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma interação encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
