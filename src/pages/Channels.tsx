import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie,
} from "recharts";
import { MessageSquare, Phone, Users, Gauge, Clock, TrendingUp, Smile, ExternalLink, Instagram, Facebook, BarChart3, Mail, UserPlus } from "lucide-react";

/* ----------------- helpers ----------------- */
import type { LucideIcon } from "lucide-react";
const CHANNEL_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  whatsapp: { label: "WhatsApp", color: "#25D366", Icon: MessageSquare },
  facebook: { label: "Facebook", color: "#1877F2", Icon: Facebook },
  instagram: { label: "Instagram", color: "#E4405F", Icon: Instagram },
  phone: { label: "Telefone", color: "#8b5cf6", Icon: Phone },
  email: { label: "E-mail", color: "#0ea5e9", Icon: Mail },
  "indicação": { label: "Indicação", color: "#f59e0b", Icon: UserPlus },
};

function normalizeChannelKey(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("facebook")) return "facebook";
  if (lower === "phone" || lower === "telefone") return "phone";
  if (lower.includes("mail")) return "email";                                   // 'email', 'e-mail'
  if (lower.includes("indica") || lower.includes("referr") || lower.includes("parceria")) return "indicação";
  return null;
}

function fmtMinutes(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1min";
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

function scoreColor(s: number | null): string {
  if (s === null) return "text-muted-foreground";
  if (s >= 70) return "text-green-500";
  if (s >= 40) return "text-yellow-500";
  return "text-red-500";
}

/* ----------------- page ----------------- */
export default function Channels() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: "30" });

  const range = useMemo(() => resolvePeriod(period), [period]);

  /* --------- queries --------- */
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["channels-leads", range.fromIso, range.toIso],
    queryFn: async () => {
      let q = supabase
        .from("lead_db")
        .select("session_id, channel, sales_status, sentiment, lead_score, lead_temperature, has_objection, objection_overcome, lead_language, created_at, last_interaction_at");
      if (range.fromIso) q = q.gte("created_at", range.fromIso);
      if (range.toIso) q = q.lte("created_at", range.toIso);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: interactions = [], isLoading: loadingInteractions } = useQuery({
    queryKey: ["channels-interactions", range.fromIso, range.toIso],
    queryFn: async () => {
      let q = supabase
        .from("interaction_db")
        .select("session_id, channel, sender_type, timestamp")
        .limit(50000);
      if (range.fromIso) q = q.gte("timestamp", range.fromIso);
      if (range.toIso) q = q.lte("timestamp", range.toIso);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: calls = [] } = useQuery({
    queryKey: ["channels-calls", range.fromIso, range.toIso],
    queryFn: async () => {
      let q = supabase
        .from("call_db")
        .select("call_id, session_id, call_duration, lead_score, ai_call_analysis, created_at");
      if (range.fromIso) q = q.gte("created_at", range.fromIso);
      if (range.toIso) q = q.lte("created_at", range.toIso);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  /* --------- per-channel aggregates --------- */
  const channelStats = useMemo(() => {
    const channels = ["whatsapp", "facebook", "instagram", "phone", "email", "indicação"] as const;
    const result: Record<string, any> = {};

    for (const ch of channels) {
      const leadsOfChannel = leads.filter((l: any) => normalizeChannelKey(l.channel) === ch);
      const totalLeads = leadsOfChannel.length;

      const closedWon = leadsOfChannel.filter((l: any) =>
        (l.sales_status || "").toLowerCase().includes("ganha")
      ).length;
      const convRate = totalLeads ? (closedWon / totalLeads) * 100 : 0;

      const scoredLeads = leadsOfChannel.filter((l: any) => typeof l.lead_score === "number");
      const avgScore = scoredLeads.length
        ? Math.round(scoredLeads.reduce((acc: number, l: any) => acc + l.lead_score, 0) / scoredLeads.length)
        : null;

      const sentimentMap = { Positivo: 0, Neutro: 0, Negativo: 0 };
      leadsOfChannel.forEach((l: any) => {
        if (l.sentiment && sentimentMap[l.sentiment as keyof typeof sentimentMap] !== undefined) {
          sentimentMap[l.sentiment as keyof typeof sentimentMap]++;
        }
      });
      const analyzedCount = sentimentMap.Positivo + sentimentMap.Neutro + sentimentMap.Negativo;
      const pctPositive = analyzedCount ? Math.round((sentimentMap.Positivo / analyzedCount) * 100) : 0;

      const withObjection = leadsOfChannel.filter((l: any) => l.has_objection).length;
      const overcomeObj = leadsOfChannel.filter((l: any) => l.has_objection && l.objection_overcome).length;
      const pctOvercome = withObjection ? Math.round((overcomeObj / withObjection) * 100) : 0;

      result[ch] = {
        totalLeads, closedWon, convRate, avgScore, sentimentMap, pctPositive,
        withObjection, pctOvercome, leadsOfChannel,
      };
    }

    return result;
  }, [leads]);

  /* --------- response time per channel (only digital) --------- */
  const responseTimeStats = useMemo(() => {
    // Group interactions by session_id and channel
    const bySession: Record<string, any[]> = {};
    interactions.forEach((i: any) => {
      const ch = normalizeChannelKey(i.channel);
      if (!ch || ch === "phone") return;
      const key = `${ch}::${i.session_id}`;
      if (!bySession[key]) bySession[key] = [];
      bySession[key].push(i);
    });

    const responseTimesByChannel: Record<string, number[]> = {};
    const totalSessionsByChannel: Record<string, number> = {};
    const respondedSessionsByChannel: Record<string, number> = {};

    for (const key of Object.keys(bySession)) {
      const [ch] = key.split("::");
      const msgs = bySession[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstClient = msgs.find((m) => !m.sender_type || m.sender_type === "client");
      if (!firstClient) continue;

      totalSessionsByChannel[ch] = (totalSessionsByChannel[ch] || 0) + 1;
      const firstClientTime = new Date(firstClient.timestamp).getTime();
      const firstAgent = msgs.find(
        (m) => m.sender_type === "agent" && new Date(m.timestamp).getTime() > firstClientTime
      );
      if (firstAgent) {
        respondedSessionsByChannel[ch] = (respondedSessionsByChannel[ch] || 0) + 1;
        const deltaMin = (new Date(firstAgent.timestamp).getTime() - firstClientTime) / 60000;
        if (deltaMin >= 0 && deltaMin < 7 * 24 * 60) {
          if (!responseTimesByChannel[ch]) responseTimesByChannel[ch] = [];
          responseTimesByChannel[ch].push(deltaMin);
        }
      }
    }

    const result: Record<string, { medianResponse: number | null; responseRate: number; totalSessions: number }> = {};
    for (const ch of ["whatsapp", "facebook", "instagram"]) {
      const arr = responseTimesByChannel[ch] || [];
      arr.sort((a, b) => a - b);
      const median = arr.length ? arr[Math.floor(arr.length / 2)] : null;
      const total = totalSessionsByChannel[ch] || 0;
      const responded = respondedSessionsByChannel[ch] || 0;
      result[ch] = {
        medianResponse: median,
        responseRate: total ? Math.round((responded / total) * 100) : 0,
        totalSessions: total,
      };
    }
    return result;
  }, [interactions]);

  /* --------- hourly heatmap data per channel --------- */
  const hourlyByChannel = useMemo(() => {
    const result: Record<string, { hour: string; count: number }[]> = {};
    for (const ch of ["whatsapp", "facebook", "instagram", "phone"]) {
      result[ch] = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, count: 0 }));
    }
    interactions.forEach((i: any) => {
      const ch = normalizeChannelKey(i.channel);
      if (!ch || ch === "phone") return;
      const h = new Date(i.timestamp).getHours();
      if (result[ch]) result[ch][h].count++;
    });
    calls.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      result.phone[h].count++;
    });
    return result;
  }, [interactions, calls]);

  /* --------- comparativo table --------- */
  const comparativeData = useMemo(() => {
    return Object.entries(channelStats).map(([ch, s]: [string, any]) => {
      const meta = CHANNEL_META[ch];
      const rt = responseTimeStats[ch];
      return {
        channel: ch,
        meta,
        totalLeads: s.totalLeads,
        closedWon: s.closedWon,
        convRate: s.convRate,
        avgScore: s.avgScore,
        pctPositive: s.pctPositive,
        medianResponse: rt?.medianResponse ?? null,
        responseRate: rt?.responseRate ?? null,
      };
    }).sort((a, b) => b.totalLeads - a.totalLeads);
  }, [channelStats, responseTimeStats]);

  /* --------- idioma × canal --------- */
  const languageByChannel = useMemo(() => {
    const norm = (l: string | null): string | null => {
      const v = (l || "").toUpperCase();
      if (v.startsWith("EN")) return "Inglês";
      if (v.startsWith("ES")) return "Espanhol";
      if (v.startsWith("PT")) return "Português";
      if (!v || v === "NDA" || v === "N/A") return null;
      return "Outro";
    };
    return ["whatsapp", "instagram", "facebook", "phone", "email", "indicação"].map((ch) => {
      const meta = CHANNEL_META[ch];
      const row: Record<string, number | string> = { channel: meta?.label ?? ch, "Inglês": 0, "Espanhol": 0, "Português": 0, "Outro": 0 };
      leads.forEach((l: any) => {
        if (normalizeChannelKey(l.channel) !== ch) return;
        const k = norm(l.lead_language);
        if (k) (row[k] as number)++;
      });
      return row;
    }).filter((r) => (r["Inglês"] as number) + (r["Espanhol"] as number) + (r["Português"] as number) + (r["Outro"] as number) > 0);
  }, [leads]);

  const loading = loadingLeads || loadingInteractions;

  /* ----------------- render ----------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Análise por Canal</h2>
          <p className="text-muted-foreground">Performance e comportamento por canal: WhatsApp, Instagram, Facebook, Telefone, E-mail e Indicação</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <Tabs defaultValue="compare">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="compare" className="gap-2">
            <BarChart3 className="h-4 w-4" />Comparativo
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="h-4 w-4" />Instagram
          </TabsTrigger>
          <TabsTrigger value="facebook" className="gap-2">
            <Facebook className="h-4 w-4" />Facebook
          </TabsTrigger>
          <TabsTrigger value="phone" className="gap-2">
            <Phone className="h-4 w-4" />Telefone
          </TabsTrigger>
        </TabsList>

        {/* ===== Comparativo ===== */}
        <TabsContent value="compare" className="space-y-6 mt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {/* KPI row: one big card per channel */}
              <MagicBentoGrid className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" glowColor="59, 130, 246">
                {comparativeData.map((c) => {
                  const ChIcon = c.meta.Icon;
                  return (
                  <MagicBentoCard key={c.channel} glowColor="59, 130, 246">
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <ChIcon className="h-4 w-4" style={{ color: c.meta.color }} />
                          {c.meta.label}
                          <ChartInfoTooltip
                            description={`Resumo de ${c.meta.label}: clientes, conversão e nota de qualidade vêm dos clientes que a IA já analisou (só conversas de WhatsApp/chat, por isso menor que o Kommo); a 1ª resposta e o % respondidas vêm das mensagens trocadas.`}
                            source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. A 1ª resposta e o % respondidas vêm das mensagens trocadas no WhatsApp/Instagram/Facebook."
                            calculation="Clientes = quantos clientes deste canal no período. Conversão = clientes marcados como venda fechada (ganha) divididos pelo total de clientes, vezes 100. Nota = a média da nota de qualidade que a IA dá ao cliente. 1ª resposta = o valor do meio (mediana) do tempo até o agente responder. % respondidas = conversas que tiveram resposta divididas pelas que o cliente começou, vezes 100."
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <div className="text-2xl font-bold" style={{ color: c.meta.color }}>{c.totalLeads}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">clientes · só WhatsApp/chat (menor que o Kommo)</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                          <div>
                            <div className="text-muted-foreground">Conversão</div>
                            <div className="font-semibold">{c.convRate.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Score</div>
                            <div className={`font-semibold ${scoreColor(c.avgScore)}`}>{c.avgScore ?? "—"}</div>
                          </div>
                          {c.medianResponse !== null && (
                            <>
                              <div>
                                <div className="text-muted-foreground">1ª resp (md)</div>
                                <div className="font-semibold">{fmtMinutes(c.medianResponse)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">% respondidas</div>
                                <div className="font-semibold">{c.responseRate}%</div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </MagicBentoCard>
                  );
                })}
              </MagicBentoGrid>

              {/* Comparative bars */}
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <MagicBentoCard glowColor="59, 130, 246">
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="flex items-center gap-2">Volume de Clientes por Canal (só WhatsApp/chat · menor que o Kommo) <ChartInfoTooltip description="Compara quantos clientes chegaram por cada canal (WhatsApp, Instagram, Facebook e Telefone); cada barra é a quantidade de clientes. Conta só conversas de WhatsApp/chat, então é menor que o total no Kommo." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes que chegaram no período, separados por canal." calculation="conta quantos clientes chegaram por cada canal (WhatsApp, Instagram, Facebook, Telefone)." /></CardTitle></CardHeader>
                    <CardContent className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativeData} margin={{ left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="meta.label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="totalLeads" radius={[4, 4, 0, 0]}>
                            {comparativeData.map((c, i) => (
                              <Cell key={i} fill={c.meta.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </MagicBentoCard>

                <MagicBentoCard glowColor="59, 130, 246">
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="flex items-center gap-2">Taxa de Conversão por Canal (só WhatsApp/chat · menor que o Kommo) <ChartInfoTooltip description="Compara quanto cada canal converte em venda; cada barra é o % de clientes que viraram venda fechada. Conta só conversas de WhatsApp/chat, então é menor que o total no Kommo." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes do período separados por canal; venda = marcados como venda fechada (ganha)." calculation="clientes marcados como venda fechada (ganha) divididos pelo total de clientes do canal, vezes 100." /></CardTitle></CardHeader>
                    <CardContent className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparativeData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="meta.label" />
                          <YAxis tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                          <Bar dataKey="convRate" radius={[4, 4, 0, 0]}>
                            {comparativeData.map((c, i) => (
                              <Cell key={i} fill={c.meta.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </MagicBentoCard>
              </div>

              {/* Ranking table */}
              <MagicBentoCard glowColor="59, 130, 246">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Ranking Comparativo
                      <ChartInfoTooltip
                        description="Compara os canais lado a lado em todas as informações. Clientes, Vendas, Conversão, Nota e % Positivo vêm dos clientes que a IA já analisou (só conversas de WhatsApp/chat, por isso menor que o Kommo); a 1ª Resp e % Respondidas vêm das mensagens trocadas."
                        source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. A 1ª Resp e o % Respondidas vêm das mensagens trocadas no WhatsApp/Instagram/Facebook."
                        calculation="Clientes = quantos clientes no período. Vendas = marcados como venda fechada (ganha). Conversão = vendas divididas pelos clientes, vezes 100. Nota = a média da nota de qualidade que a IA dá ao cliente. % Positivo = clientes com sentimento positivo divididos pelos que a IA analisou. 1ª Resp = o valor do meio (mediana) do tempo até o agente responder. % Respondidas = conversas que tiveram resposta divididas pelas que o cliente começou, vezes 100."
                      />
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Compare canais lado a lado em todas as informações · Clientes/Conversão = só WhatsApp/chat (menor que o Kommo)</p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Conversão</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">% Positivo</TableHead>
                          <TableHead className="text-right">1ª Resp (mediana)</TableHead>
                          <TableHead className="text-right">% Respondidas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativeData.map((c) => (
                          <TableRow key={c.channel}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.meta.color }} />
                                <span className="font-medium">{c.meta.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{c.totalLeads}</TableCell>
                            <TableCell className="text-right">{c.closedWon}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={c.convRate >= 10 ? "default" : "secondary"} className="text-xs">
                                {c.convRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${scoreColor(c.avgScore)}`}>{c.avgScore ?? "—"}</TableCell>
                            <TableCell className="text-right">{c.pctPositive}%</TableCell>
                            <TableCell className="text-right">{fmtMinutes(c.medianResponse)}</TableCell>
                            <TableCell className="text-right">
                              {c.responseRate !== null ? (
                                <Badge variant={c.responseRate >= 80 ? "default" : c.responseRate >= 50 ? "secondary" : "destructive"} className="text-xs">
                                  {c.responseRate}%
                                </Badge>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </MagicBentoCard>

              {/* Idioma × Canal */}
              {languageByChannel.length > 0 && (
                <MagicBentoCard glowColor="59, 130, 246">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Idiomas por canal
                        <ChartInfoTooltip
                          description="Mostra a mistura de idiomas (Inglês, Espanhol, Português) dentro de cada canal — quem fala o quê em cada origem."
                          source="conta só os clientes que chegaram por conversa de WhatsApp/chat no período e tiveram o idioma identificado na conversa. O idioma é identificado em cerca de metade das conversas (~52%), então é uma amostra, não o total."
                          calculation="para cada canal, conta os clientes por idioma (Inglês, Espanhol, Português e os demais como Outro) e empilha as barras."
                        />
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Mistura de idiomas por canal · conversas com idioma identificado (amostra)</p>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={languageByChannel}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Inglês" stackId="lang" fill="#3b82f6" />
                          <Bar dataKey="Espanhol" stackId="lang" fill="#f59e0b" />
                          <Bar dataKey="Português" stackId="lang" fill="#10b981" />
                          <Bar dataKey="Outro" stackId="lang" fill="#9ca3af" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </MagicBentoCard>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== Per-channel tabs ===== */}
        {(["whatsapp", "instagram", "facebook"] as const).map((ch) => (
          <TabsContent key={ch} value={ch} className="space-y-6 mt-6">
            <ChannelDetail
              channel={ch}
              stats={channelStats[ch]}
              responseStats={responseTimeStats[ch]}
              hourly={hourlyByChannel[ch]}
              loading={loading}
            />
          </TabsContent>
        ))}

        {/* ===== Telefone tab (links to /calls) ===== */}
        <TabsContent value="phone" className="space-y-6 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-purple-500" />
                Análise de Telefone
                <ChartInfoTooltip
                  description="Resumo do canal telefone: clientes, nota de qualidade e conversão vêm dos clientes que a IA já analisou (só conversas de chat, por isso menor que o Kommo); 'chamadas no período' vem das ligações telefônicas registradas."
                  source="clientes, nota e conversão: conta só os clientes que chegaram por conversa de chat, por isso o número é menor que o total no Kommo. Chamadas: as ligações telefônicas registradas (com transcrição feita por IA)."
                  calculation="Clientes = clientes do canal telefone no período. Nota = a média da nota de qualidade que a IA dá ao cliente. Conversão = clientes marcados como venda fechada (ganha) divididos pelos clientes, vezes 100. Chamadas = quantas ligações registradas no período."
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A análise completa de chamadas (com direção ativa/passiva, transcrição, score, compliance, objeções)
                está numa página dedicada — ela tem muito mais profundidade do que cabe nesta aba.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-purple-500">{channelStats.phone?.totalLeads || 0}</div>
                  <div className="text-xs text-muted-foreground">clientes de telefone · só conversas de chat (menor que o Kommo)</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{calls.length}</div>
                  <div className="text-xs text-muted-foreground">chamadas no período</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className={`text-2xl font-bold ${scoreColor(channelStats.phone?.avgScore ?? null)}`}>
                    {channelStats.phone?.avgScore ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">score médio</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{channelStats.phone?.convRate.toFixed(1) || 0}%</div>
                  <div className="text-xs text-muted-foreground">taxa de conversão</div>
                </div>
              </div>
              <Button asChild>
                <Link to="/calls" className="inline-flex items-center gap-2">
                  Abrir análise completa de chamadas
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------- ChannelDetail sub-component ----------------- */
function ChannelDetail({
  channel, stats, responseStats, hourly, loading,
}: {
  channel: "whatsapp" | "instagram" | "facebook";
  stats: any;
  responseStats: any;
  hourly: { hour: string; count: number }[];
  loading: boolean;
}) {
  const meta = CHANNEL_META[channel];

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (!stats || stats.totalLeads === 0) {
    return <div className="text-center py-12 text-muted-foreground">Nenhum lead deste canal no período.</div>;
  }

  const sentimentData = Object.entries(stats.sentimentMap)
    .map(([name, value]) => ({ name, value: value as number }))
    .filter((d) => d.value > 0);

  const sentimentColors: Record<string, string> = {
    Positivo: "#22c55e",
    Neutro: "#94a3b8",
    Negativo: "#ef4444",
  };

  return (
    <>
      {/* KPIs */}
      <MagicBentoGrid className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6" glowColor="59, 130, 246">
        <KPI
          label="Clientes · só WhatsApp/chat (menor que o Kommo)"
          value={stats.totalLeads}
          icon={Users}
          color={meta.color}
          info={{
            description: `Quantos clientes de ${meta.label} chegaram no período. Conta só conversas de WhatsApp/chat, então é menor que o total no Kommo.`,
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste canal no período.",
            calculation: "conta os clientes deste canal que chegaram dentro do período selecionado.",
          }}
        />
        <KPI
          label="Vendas fechadas · só WhatsApp/chat"
          value={stats.closedWon}
          icon={TrendingUp}
          color="#22c55e"
          info={{
            description: `Clientes de ${meta.label} marcados como venda fechada (ganha). Conta só conversas de WhatsApp/chat, não o total de vendas no Kommo.`,
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os marcados como venda fechada (ganha).",
            calculation: "conta os clientes do canal marcados como venda fechada (ganha).",
          }}
        />
        <KPI
          label="Conversão · só WhatsApp/chat"
          value={`${stats.convRate.toFixed(1)}%`}
          icon={Gauge}
          color={meta.color}
          info={{
            description: `% de clientes de ${meta.label} que viraram venda. Conta só conversas de WhatsApp/chat, então é menor que o total no Kommo.`,
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: venda = marcados como venda fechada (ganha).",
            calculation: "clientes marcados como venda fechada (ganha) divididos pelo total de clientes do canal, vezes 100.",
          }}
        />
        <KPI
          label="Nota média · só WhatsApp/chat"
          value={stats.avgScore ?? "—"}
          icon={Gauge}
          color={stats.avgScore && stats.avgScore >= 70 ? "#22c55e" : stats.avgScore && stats.avgScore >= 40 ? "#eab308" : "#ef4444"}
          info={{
            description: `A média da nota de qualidade (de 0 a 100) que a IA dá aos clientes de ${meta.label}. Considera só os clientes que a IA já analisou.`,
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: só os clientes que a IA já analisou.",
            calculation: "a média da nota de qualidade que a IA dá ao cliente, considerando os clientes do canal que receberam nota, arredondada.",
          }}
        />
        <KPI
          label="1ª resposta (md)"
          value={fmtMinutes(responseStats?.medianResponse ?? null)}
          icon={Clock}
          color={responseStats?.medianResponse !== null && responseStats?.medianResponse < 60 ? "#22c55e" : "#eab308"}
          info={{
            description: `O tempo do meio (mediana) até o agente dar a primeira resposta depois da primeira mensagem do cliente em ${meta.label}.`,
            source: "as mensagens trocadas no WhatsApp/Instagram/Facebook. Aqui: as conversas do canal que tiveram resposta do agente.",
            calculation: "em cada conversa, o tempo em minutos entre a primeira mensagem do cliente e a primeira resposta do agente; mostra o valor do meio (mediana) e ignora tempos negativos ou acima de 7 dias.",
          }}
        />
        <KPI
          label="% respondidas"
          value={`${responseStats?.responseRate ?? 0}%`}
          icon={MessageSquare}
          color={responseStats?.responseRate >= 80 ? "#22c55e" : "#eab308"}
          info={{
            description: `% de conversas de ${meta.label} começadas pelo cliente que receberam ao menos uma resposta do agente.`,
            source: "as mensagens trocadas no WhatsApp/Instagram/Facebook. Aqui: as conversas do canal que o cliente começou.",
            calculation: "conversas que tiveram resposta do agente divididas pelas conversas que o cliente começou, vezes 100.",
          }}
        />
      </MagicBentoGrid>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Sentiment donut */}
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><Smile className="h-4 w-4" />Sentimento <ChartInfoTooltip description="Mostra como ficou o clima das conversas (Positivo, Neutro, Negativo) dos clientes deste canal; cada fatia é a parcela de clientes em cada categoria." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Aqui: só os clientes deste canal que a IA já analisou e classificou o clima da conversa." calculation="conta os clientes em cada categoria (Positivo, Neutro, Negativo); a fatia é a parte de cada categoria sobre o total que a IA analisou." /></CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {sentimentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sentimentData.map((entry, i) => (
                        <Cell key={i} fill={sentimentColors[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem leads analisados</div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>

        {/* Hourly heatmap as bar chart */}
        <MagicBentoCard className="lg:col-span-2" glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Mensagens por hora do dia <ChartInfoTooltip description="Mostra quantas mensagens deste canal chegam em cada hora do dia (0h às 23h); cada barra é a quantidade de mensagens, para enxergar os horários de pico." source="as mensagens trocadas no WhatsApp/Instagram/Facebook deste canal no período." calculation="separa as mensagens pela hora em que chegaram e soma quantas houve em cada uma das 24 horas do dia." /></CardTitle>
              <p className="text-xs text-muted-foreground">Identifique horários de pico pra dimensionar equipe</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={meta.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Insights card */}
      <MagicBentoCard glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="flex items-center gap-2">
            Insights de {meta.label}
            <ChartInfoTooltip
              description={`Resumo do canal: total de clientes, quantos responderam e as objeções. Os totais de clientes contam só conversas de WhatsApp/chat (menor que o Kommo); os respondidos vêm das mensagens trocadas.`}
              source="Total de clientes e objeções: conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Clientes que responderam: vêm das mensagens trocadas no WhatsApp/Instagram/Facebook."
              calculation="Total de clientes = quantos clientes deste canal no período. Clientes que responderam = conversas em que o cliente mandou a primeira mensagem. Taxa de objeções = clientes que levantaram alguma objeção divididos pelo total, vezes 100. % contornadas = objeções que foram contornadas divididas pelos clientes que levantaram objeção, vezes 100."
            />
          </CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Total de leads originados</span>
                <span className="font-semibold">{stats.totalLeads}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Leads que iniciaram conversa</span>
                <span className="font-semibold">{responseStats?.totalSessions ?? 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Taxa de objeções</span>
                <span className="font-semibold">{stats.withObjection} ({stats.totalLeads ? Math.round((stats.withObjection / stats.totalLeads) * 100) : 0}%)</span>
              </li>
              <li className="flex items-center justify-between">
                <span>% objeções contornadas</span>
                <span className="font-semibold">{stats.pctOvercome}%</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </MagicBentoCard>
    </>
  );
}

function KPI({ label, value, icon: Icon, color, info }: {
  label: string;
  value: any;
  icon: any;
  color: string;
  info?: { description: string; source?: string; calculation?: string };
}) {
  return (
    <MagicBentoCard glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            {label}
            {info && (
              <ChartInfoTooltip
                description={info.description}
                source={info.source}
                calculation={info.calculation}
              />
            )}
          </CardTitle>
          <Icon className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold" style={{ color }}>{value}</div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}
