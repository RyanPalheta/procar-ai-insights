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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { useState } from "react";
import { FileText, Brain, Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";

export default function Calls() {
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_db").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const avgDuration = calls?.length
    ? Math.round(calls.reduce((acc, call) => acc + (call.call_duration || 0), 0) / calls.length)
    : 0;

  const callsByDay = calls?.reduce((acc: any, call) => {
    const date = new Date(call.created_at).toLocaleDateString("pt-BR");
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const chartData = callsByDay
    ? Object.entries(callsByDay).map(([date, count]) => ({ date, count }))
    : [];

  const transcribedCount = calls?.filter((c) => (c as any).transcription_status === "completed").length || 0;

  const getTranscriptionBadge = (status: string | null) => {
    switch (status) {
      case "completed": return <Badge variant="success">Transcrita</Badge>;
      case "processing": return <Badge variant="warning">Transcrevendo</Badge>;
      case "pending": return <Badge variant="secondary">Pendente</Badge>;
      case "failed": return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">N/A</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Chamadas</h2>
        <p className="text-muted-foreground">
          Análise detalhada de todas as chamadas
        </p>
      </div>

      <MagicBentoGrid className="grid gap-4 grid-cols-2 md:grid-cols-4" glowColor="59, 130, 246">
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
              <CardTitle className="text-sm font-medium">Transcritas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transcribedCount}</div>
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
                      <TableHead>De / Para</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Transcrição</TableHead>
                      <TableHead>Análise IA</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((call) => {
                      const c = call as any;
                      return (
                        <TableRow key={call.call_id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {call.type || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.from_number ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1"><PhoneOutgoing className="h-3 w-3" />{c.from_number}</div>
                                <div className="flex items-center gap-1"><PhoneIncoming className="h-3 w-3" />{c.to_number || "N/A"}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.call_status === "completed" ? "success" : "secondary"}>
                              {c.call_status || call.call_tag || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>{call.call_duration || 0}s</TableCell>
                          <TableCell>{getTranscriptionBadge(c.transcription_status)}</TableCell>
                          <TableCell>
                            <Badge variant={call.ai_analysis_status === "completed" ? "success" : "secondary"}>
                              {call.ai_analysis_status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>{call.lead_score || "N/A"}</TableCell>
                          <TableCell>{new Date(call.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {c.transcription_text && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setSelectedCall(c); setShowTranscription(true); }}
                                  title="Ver Transcrição"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                              {c.ai_call_analysis && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setSelectedCall(c); setShowAnalysis(true); }}
                                  title="Ver Análise IA"
                                >
                                  <Brain className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      {/* Transcription Dialog */}
      <Dialog open={showTranscription} onOpenChange={setShowTranscription}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcrição da Chamada
            </DialogTitle>
            <DialogDescription>
              {selectedCall?.from_number && `${selectedCall.from_number} → ${selectedCall.to_number}`}
              {selectedCall?.call_duration && ` • ${selectedCall.call_duration}s`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-lg">
              {selectedCall?.transcription_text || "Sem transcrição disponível"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Análise de IA da Chamada
            </DialogTitle>
            <DialogDescription>Resultado da análise automatizada</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            {selectedCall?.ai_call_analysis ? (() => {
              const a = selectedCall.ai_call_analysis;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Qualidade</p><p className="text-2xl font-bold">{a.quality_score || "N/A"}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Sentimento</p><p className="text-lg font-semibold">{a.sentiment || "N/A"}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Compliance</p><p className="text-2xl font-bold">{a.compliance_score ?? "N/A"}</p></CardContent></Card>
                  </div>
                  {a.executive_summary && (
                    <div><h4 className="font-semibold mb-1">Resumo</h4><p className="text-sm text-muted-foreground">{a.executive_summary}</p></div>
                  )}
                  {a.improvement_points?.length > 0 && (
                    <div><h4 className="font-semibold mb-1">Pontos de Melhoria</h4><ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">{a.improvement_points.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                  )}
                  {a.has_objection && (
                    <div><h4 className="font-semibold mb-1">Objeções</h4><p className="text-sm text-muted-foreground">{a.objection_detail}</p><p className="text-xs mt-1">{a.objection_overcome ? "✅ Contornada" : "❌ Não contornada"}</p></div>
                  )}
                  {a.sales_opportunities?.length > 0 && (
                    <div><h4 className="font-semibold mb-1">Oportunidades</h4><ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">{a.sales_opportunities.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                  )}
                  {a.call_tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">{a.call_tags.map((t: string, i: number) => <Badge key={i} variant="secondary">{t}</Badge>)}</div>
                  )}
                </>
              );
            })() : <p className="text-muted-foreground">Sem análise disponível</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
