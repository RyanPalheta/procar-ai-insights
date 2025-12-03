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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

export default function Calls() {
  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_db").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate average call duration
  const avgDuration = calls?.length
    ? Math.round(calls.reduce((acc, call) => acc + (call.call_duration || 0), 0) / calls.length)
    : 0;

  // Group calls by day for chart
  const callsByDay = calls?.reduce((acc: any, call) => {
    const date = new Date(call.created_at).toLocaleDateString("pt-BR");
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const chartData = callsByDay
    ? Object.entries(callsByDay).map(([date, count]) => ({ date, count }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Chamadas</h2>
        <p className="text-muted-foreground">
          Análise detalhada de todas as chamadas
        </p>
      </div>

      <MagicBentoGrid className="grid gap-4 md:grid-cols-3" glowColor="59, 130, 246">
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total de Chamadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calls?.length || 0}</div>
            </CardContent>
          </Card>
        </MagicBentoCard>
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDuration}s</div>
            </CardContent>
          </Card>
        </MagicBentoCard>
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Analisadas pela IA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calls?.filter((c) => c.ai_analysis_status === "completed").length || 0}
              </div>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </MagicBentoGrid>

      <MagicBentoCard glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Volume de Chamadas por Dia</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </MagicBentoCard>

      <MagicBentoCard glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Lista de Chamadas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Carregando...</div>
            ) : calls && calls.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status IA</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((call) => (
                      <TableRow key={call.call_id}>
                        <TableCell>{call.type || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{call.call_tag || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>{call.call_result || "N/A"}</TableCell>
                        <TableCell>{call.call_duration || 0}s</TableCell>
                        <TableCell>
                          <Badge
                            variant={call.ai_analysis_status === "completed" ? "success" : "secondary"}
                          >
                            {call.ai_analysis_status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.lead_score || "N/A"}</TableCell>
                        <TableCell>
                          {new Date(call.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma chamada encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </MagicBentoCard>
    </div>
  );
}