import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";

export default function Interactions() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: "30" });
  const range = useMemo(() => resolvePeriod(period), [period]);

  const { data: interactions, isLoading } = useQuery({
    queryKey: ["interactions", range.fromIso, range.toIso],
    queryFn: async () => {
      let q = supabase
        .from("interaction_db")
        .select(`
          *,
          lead:lead_db!interaction_db_session_id_fkey(
            processed
          )
        `)
        .order("timestamp", { ascending: false })
        .limit(5000);
      if (range.fromIso) q = q.gte("timestamp", range.fromIso);
      if (range.toIso) q = q.lte("timestamp", range.toIso);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Interações</h2>
          <p className="text-muted-foreground">
            Análise de mensagens e interações com clientes
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <MagicBentoGrid className="grid gap-4 md:grid-cols-2" glowColor="228, 0, 43">
        <MagicBentoCard glowColor="228, 0, 43">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total de Interações
                <ChartInfoTooltip
                  description="Quantas mensagens foram trocadas com clientes no período selecionado."
                  source="as mensagens trocadas no WhatsApp/Instagram/Facebook. Não vem do Kommo."
                  calculation="conta cada mensagem trocada no período (mostra as 5000 mais recentes)."
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{interactions?.length || 0}</div>
            </CardContent>
          </Card>
        </MagicBentoCard>
        <MagicBentoCard glowColor="228, 0, 43">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Processadas
                <ChartInfoTooltip
                  description="Mensagens de clientes que a IA já analisou."
                  source="as mensagens trocadas no WhatsApp/Instagram/Facebook, ligadas ao cliente da conversa. Não vem do Kommo."
                  calculation="conta as mensagens do período em que o cliente da conversa já foi analisado pela IA."
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interactions?.filter((i) => i.lead?.processed).length || 0}
              </div>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </MagicBentoGrid>

      <MagicBentoCard glowColor="228, 0, 43" enableTilt={false} enableMagnetism={false}>
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