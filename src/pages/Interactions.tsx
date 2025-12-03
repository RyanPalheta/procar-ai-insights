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
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

export default function Interactions() {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ["interactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interaction_db")
        .select(`
          *,
          lead:lead_db!interaction_db_session_id_fkey(
            processed
          )
        `)
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Interações</h2>
        <p className="text-muted-foreground">
          Análise de mensagens e interações com clientes
        </p>
      </div>

      <MagicBentoGrid className="grid gap-4 md:grid-cols-2" glowColor="59, 130, 246">
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total de Interações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{interactions?.length || 0}</div>
            </CardContent>
          </Card>
        </MagicBentoCard>
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Processadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interactions?.filter((i) => i.lead?.processed).length || 0}
              </div>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </MagicBentoGrid>

      <MagicBentoCard glowColor="59, 130, 246">
        <Card className="bg-card border-border">
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
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Remetente</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Processado</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interactions.map((interaction) => (
                      <TableRow key={interaction.interaction_id}>
                        <TableCell className="font-medium">
                          {interaction.session_id || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{interaction.channel || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>{interaction.sender_type || "N/A"}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {interaction.message_text || "N/A"}
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
      </MagicBentoCard>
    </div>
  );
}