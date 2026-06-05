import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { DonutChart } from "@tremor/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Users, MessageSquare, Phone, DollarSign, Gauge, AlertTriangle,
  PhoneIncoming, PhoneOutgoing, ArrowRight, TrendingUp, TrendingDown, Minus, Clock,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, formatDistanceToNow, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCallDirection } from "@/lib/calls";

const REFRESH_INTERVAL_MS = 30_000;

// Tempo após o qual um lead "quente" sem resposta vira alerta
const HOT_LEAD_THRESHOLD_MINUTES = 60;
const HOT_LEAD_SCORE_THRESHOLD = 70;

interface LeadRow {
  session_id: number;
  channel: string | null;
  sales_status: string | null;
  sentiment: string | null;
  lead_score: number | null;
  lead_temperature: string | null;
  need_summary: string | null;
  service_desired: string | null;
  created_at: string;
  last_interaction_at: string | null;
  last_ai_update: string | null;
}

interface InteractionRow {
  interaction_id: string;
  session_id: number;
  channel: string | null;
  sender_type: string | null;
  message_text: string | null;
  timestamp: string;
}

interface CallRow {
  call_id: string;
  session_id: number | null;
  type: string | null;
  call_duration: number | null;
  from_number: string | null;
  to_number: string | null;
  call_status: string | null;
  created_at: string;
  lead_score: number | null;
}

function normalizeChannel(channel: string | null): string {
  if (!channel) return "N/A";
  const lower = channel.toLowerCase();
  if (lower === "whatsapp") return "WhatsApp";
  if (lower === "facebook") return "Facebook";
  if (lower.includes("instagram")) return "Instagram";
  if (lower === "phone") return "Telefone";
  return channel;
}

function variationBadge(today: number, yesterday: number) {
  if (yesterday === 0) {
    return today > 0
      ? { label: "novo", trend: "up" as const }
      : { label: "—", trend: "neutral" as const };
  }
  const delta = ((today - yesterday) / yesterday) * 100;
  const sign = delta > 0 ? "+" : "";
  return {
    label: `${sign}${delta.toFixed(0)}% vs ontem`,
    trend: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("neutral" as const),
  };
}

function TrendIcon({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-rose-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function KPICard({
  title, value, icon: Icon, glowColor, footer,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  glowColor: string;
  footer?: React.ReactNode;
}) {
  return (
    <MagicBentoCard glowColor={glowColor}>
      <Card className="bg-card border-border h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {footer && <div className="text-xs text-muted-foreground mt-1">{footer}</div>}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

export default function Today() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  // Re-render relative timestamps each minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayStart = useMemo(() => startOfDay(now), [now]);
  const todayEnd = useMemo(() => endOfDay(now), [now]);
  const yesterdayStart = useMemo(() => startOfDay(subDays(now, 1)), [now]);
  const yesterdayEnd = useMemo(() => endOfDay(subDays(now, 1)), [now]);

  // --- Leads criados hoje + ontem ---
  const { data: leadsToday = [], isLoading: loadingLeads, error: leadsError } = useQuery<LeadRow[]>({
    queryKey: ["today-leads", format(todayStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("session_id, channel, sales_status, sentiment, lead_score, lead_temperature, need_summary, service_desired, created_at, last_interaction_at, last_ai_update")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Today] leadsToday query error:", error);
        throw error;
      }
      return (data as LeadRow[]) || [];
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: 1, // Fail fast — better to show 0 than infinite "—"
  });

  const { data: leadsYesterday = [] } = useQuery<{ session_id: number; sales_status: string | null }[]>({
    queryKey: ["yesterday-leads", format(yesterdayStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("session_id, sales_status")
        .gte("created_at", yesterdayStart.toISOString())
        .lte("created_at", yesterdayEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60_000,
  });

  // --- Interações hoje ---
  const { data: interactionsToday = [], isLoading: loadingInteractions } = useQuery<InteractionRow[]>({
    queryKey: ["today-interactions", format(todayStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interaction_db")
        .select("interaction_id, session_id, channel, sender_type, message_text, timestamp")
        .gte("timestamp", todayStart.toISOString())
        .lte("timestamp", todayEnd.toISOString())
        .order("timestamp", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as InteractionRow[]) || [];
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // --- Chamadas hoje ---
  const { data: callsToday = [], isLoading: loadingCalls } = useQuery<CallRow[]>({
    queryKey: ["today-calls", format(todayStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_db")
        .select("call_id, session_id, type, call_duration, from_number, to_number, call_status, created_at, lead_score")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CallRow[]) || [];
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // --- Métricas derivadas ---
  const metrics = useMemo(() => {
    const totalLeads = leadsToday.length;
    const totalInteractions = interactionsToday.length;
    const totalCalls = callsToday.length;
    const totalLeadsYesterday = leadsYesterday.length;

    // Call direction breakdown
    let activeCalls = 0;
    let passiveCalls = 0;
    callsToday.forEach((c) => {
      const dir = getCallDirection(c);
      if (dir === "active") activeCalls++;
      else if (dir === "passive") passiveCalls++;
    });

    const closedToday = leadsToday.filter(
      (l) => l.sales_status?.toLowerCase().includes("ganha")
    ).length;
    const closedYesterday = leadsYesterday.filter(
      (l) => l.sales_status?.toLowerCase().includes("ganha")
    ).length;

    const scoredLeads = leadsToday.filter((l) => typeof l.lead_score === "number");
    const avgScore = scoredLeads.length > 0
      ? Math.round(scoredLeads.reduce((acc, l) => acc + (l.lead_score || 0), 0) / scoredLeads.length)
      : 0;

    // Channel distribution today
    const channelMap = new Map<string, number>();
    leadsToday.forEach((l) => {
      const c = normalizeChannel(l.channel);
      channelMap.set(c, (channelMap.get(c) || 0) + 1);
    });
    const channelData = Array.from(channelMap.entries()).map(([name, value]) => ({ name, value }));

    // Sentiment distribution today
    const sentimentMap = new Map<string, number>();
    leadsToday.forEach((l) => {
      if (l.sentiment) sentimentMap.set(l.sentiment, (sentimentMap.get(l.sentiment) || 0) + 1);
    });
    const sentimentData = Array.from(sentimentMap.entries()).map(([name, value]) => ({ name, value }));

    // Leads per hour (0-23)
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, leads: 0, calls: 0 }));
    leadsToday.forEach((l) => {
      const h = new Date(l.created_at).getHours();
      hourly[h].leads++;
    });
    callsToday.forEach((c) => {
      const h = new Date(c.created_at).getHours();
      hourly[h].calls++;
    });

    return {
      totalLeads, totalLeadsYesterday, totalInteractions, totalCalls,
      activeCalls, passiveCalls,
      closedToday, closedYesterday, avgScore,
      channelData, sentimentData, hourly,
    };
  }, [leadsToday, leadsYesterday, interactionsToday, callsToday]);

  // --- Hot leads sem resposta ---
  const { data: allHotLeads = [] } = useQuery<LeadRow[]>({
    queryKey: ["hot-leads-no-response"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("session_id, channel, sales_status, sentiment, lead_score, lead_temperature, need_summary, service_desired, created_at, last_interaction_at, last_ai_update")
        .gte("lead_score", HOT_LEAD_SCORE_THRESHOLD)
        .order("lead_score", { ascending: false })
        .limit(100);
      if (error) {
        console.error("[Today] hot leads query error:", error);
        throw error;
      }
      // Filter closed statuses client-side (avoids fragile Supabase NOT-ILIKE chains)
      return ((data as LeadRow[]) || []).filter((l) => {
        const s = (l.sales_status || "").toLowerCase();
        return !s.includes("ganha") && !s.includes("perdida") && !s.includes("descartada");
      });
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: 1,
  });

  const needsAttention = useMemo(() => {
    return allHotLeads.filter((l) => {
      if (!l.last_interaction_at) return true;
      const minutesSince = differenceInMinutes(now, parseISO(l.last_interaction_at));
      return minutesSince >= HOT_LEAD_THRESHOLD_MINUTES;
    }).slice(0, 10);
  }, [allHotLeads, now]);

  // --- Live activity feed (merged) ---
  const activityFeed = useMemo(() => {
    type Item = {
      key: string;
      time: Date;
      type: "interaction" | "call";
      session_id: number | null;
      channel: string;
      sender_type?: string | null;
      message: string;
    };
    const items: Item[] = [];

    interactionsToday.forEach((i) => {
      items.push({
        key: `i-${i.interaction_id}`,
        time: parseISO(i.timestamp),
        type: "interaction",
        session_id: i.session_id,
        channel: normalizeChannel(i.channel),
        sender_type: i.sender_type,
        message: i.message_text?.slice(0, 120) || "(sem texto)",
      });
    });
    callsToday.forEach((c) => {
      const dir = getCallDirection(c);
      const dirLabel = dir === "active" ? "ATIVA" : dir === "passive" ? "PASSIVA" : "—";
      items.push({
        key: `c-${c.call_id}`,
        time: parseISO(c.created_at),
        type: "call",
        session_id: c.session_id,
        channel: "Telefone",
        // Encode direction into sender_type so the icon switches color
        sender_type: dir === "active" ? "agent" : dir === "passive" ? "client" : null,
        message: `${dirLabel} • ${c.from_number || "?"} → ${c.to_number || "?"} • ${c.call_duration || 0}s`,
      });
    });

    items.sort((a, b) => b.time.getTime() - a.time.getTime());
    return items.slice(0, 40);
  }, [interactionsToday, callsToday]);

  const leadsVariation = variationBadge(metrics.totalLeads, metrics.totalLeadsYesterday);
  const closedVariation = variationBadge(metrics.closedToday, metrics.closedYesterday);

  const channelColors = ["emerald", "blue", "pink", "amber", "gray"];
  const sentimentColors = ["emerald", "gray", "rose"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Hoje</h2>
            <Badge variant="outline" className="text-xs">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              ao vivo
            </Badge>
          </div>
          <p className="text-muted-foreground capitalize">
            {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Atualiza automaticamente a cada 30s • última: {format(now, "HH:mm:ss")}
        </p>
      </div>

      {/* KPIs */}
      <MagicBentoGrid className="grid gap-4 grid-cols-2 lg:grid-cols-6" glowColor="59, 130, 246">
        <KPICard
          title="Novos leads"
          value={loadingLeads ? "—" : metrics.totalLeads}
          icon={Users}
          glowColor="16, 185, 129"
          footer={
            <span className="flex items-center gap-1">
              <TrendIcon trend={leadsVariation.trend} />
              {leadsVariation.label}
            </span>
          }
        />
        <KPICard
          title="Mensagens"
          value={loadingInteractions ? "—" : metrics.totalInteractions}
          icon={MessageSquare}
          glowColor="59, 130, 246"
          footer="recebidas e enviadas"
        />
        <KPICard
          title="Chamadas"
          value={loadingCalls ? "—" : metrics.totalCalls}
          icon={Phone}
          glowColor="139, 92, 246"
          footer={
            loadingCalls ? null : (
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-1" title="Saída (vendedor ligou)">
                  <PhoneOutgoing className="h-3 w-3 text-blue-500" />
                  <span className="font-medium text-foreground">{metrics.activeCalls}</span> ativas
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="flex items-center gap-1" title="Entrada (cliente ligou)">
                  <PhoneIncoming className="h-3 w-3 text-emerald-500" />
                  <span className="font-medium text-foreground">{metrics.passiveCalls}</span> passivas
                </span>
              </span>
            )
          }
        />
        <KPICard
          title="Vendas"
          value={metrics.closedToday}
          icon={DollarSign}
          glowColor="245, 158, 11"
          footer={
            <span className="flex items-center gap-1">
              <TrendIcon trend={closedVariation.trend} />
              {closedVariation.label}
            </span>
          }
        />
        <KPICard
          title="Score médio"
          value={metrics.avgScore || "—"}
          icon={Gauge}
          glowColor="14, 165, 233"
          footer={metrics.avgScore >= 70 ? "alta qualidade" : metrics.avgScore >= 40 ? "moderado" : "baixo"}
        />
        <KPICard
          title="Atenção"
          value={needsAttention.length}
          icon={AlertTriangle}
          glowColor="239, 68, 68"
          footer={`hot leads sem resposta há ${HOT_LEAD_THRESHOLD_MINUTES}min+`}
        />
      </MagicBentoGrid>

      {/* Middle: live feed (2/3) + side charts (1/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live feed */}
        <MagicBentoCard className="lg:col-span-2" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Atividade ao vivo</CardTitle>
              <Badge variant="secondary" className="text-xs">{activityFeed.length} eventos</Badge>
            </CardHeader>
            <CardContent>
              {activityFeed.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhuma atividade ainda hoje. Os eventos aparecem aqui assim que chegam.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-1 pr-2">
                  {activityFeed.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => item.session_id && navigate(`/leads/${item.session_id}`)}
                    >
                      <div className="mt-0.5">
                        {item.type === "call" && item.sender_type === "agent" ? (
                          <PhoneOutgoing className="h-4 w-4 text-blue-500" title="Chamada ativa" />
                        ) : item.type === "call" && item.sender_type === "client" ? (
                          <PhoneIncoming className="h-4 w-4 text-emerald-500" title="Chamada passiva" />
                        ) : item.type === "call" ? (
                          <Phone className="h-4 w-4 text-purple-500" />
                        ) : item.sender_type === "agent" ? (
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{format(item.time, "HH:mm")}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.channel}</Badge>
                          {item.type === "interaction" && item.sender_type && (
                            <span>• {item.sender_type === "agent" ? "vendedor" : "cliente"}</span>
                          )}
                          {item.session_id && (
                            <span>• #{item.session_id}</span>
                          )}
                        </div>
                        <div className="text-sm truncate mt-0.5">{item.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>

        {/* Side charts */}
        <div className="space-y-4">
          <MagicBentoCard glowColor="16, 185, 129">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Canais de hoje <ChartInfoTooltip description="Distribui os leads criados hoje por canal de origem (WhatsApp, Instagram, Facebook, Telefone) para mostrar de onde vêm os contatos do dia." source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads criados hoje (created_at entre o início e o fim do dia)." calculation="Conta quantos leads de hoje há em cada canal normalizado e exibe cada fatia da rosca como esse total." /></CardTitle></CardHeader>
              <CardContent>
                {metrics.channelData.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">Sem dados</p>
                ) : (
                  <DonutChart
                    data={metrics.channelData}
                    category="value"
                    index="name"
                    colors={channelColors}
                    showAnimation
                    className="h-[150px]"
                  />
                )}
              </CardContent>
            </Card>
          </MagicBentoCard>

          <MagicBentoCard glowColor="245, 158, 11">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Sentimento de hoje <ChartInfoTooltip description="Distribui os leads criados hoje pelo sentimento detectado pela IA (Positivo, Neutro, Negativo) para mostrar o clima dos contatos do dia." source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads criados hoje com o campo sentiment preenchido pela IA." calculation="Conta quantos leads de hoje há em cada categoria de sentimento e exibe cada fatia da rosca como esse total." /></CardTitle></CardHeader>
              <CardContent>
                {metrics.sentimentData.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">Sem leads analisados</p>
                ) : (
                  <DonutChart
                    data={metrics.sentimentData}
                    category="value"
                    index="name"
                    colors={sentimentColors}
                    showAnimation
                    className="h-[150px]"
                  />
                )}
              </CardContent>
            </Card>
          </MagicBentoCard>
        </div>
      </div>

      {/* Hourly distribution */}
      <MagicBentoCard glowColor="139, 92, 246">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="flex items-center gap-2">Distribuição por hora <ChartInfoTooltip description="Eixo X = horas do dia (0h a 23h); as barras comparam o volume de leads novos e de chamadas em cada hora de hoje." source="Leads do banco do dashboard (Supabase, tabela lead_db) e chamadas registradas via Twilio (tabela call_db); ambos criados hoje. Não é leitura ao vivo da Kommo." calculation="Para cada hora, conta os leads e as chamadas cujo created_at cai naquela hora e plota duas barras (Leads e Chamadas)." /></CardTitle></CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.hourly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" fill="rgb(139, 92, 246)" name="Chamadas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </MagicBentoCard>

      {/* Needs attention */}
      <MagicBentoCard glowColor="239, 68, 68">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Leads quentes sem resposta
            </CardTitle>
            <Badge variant="destructive" className="text-xs">
              {needsAttention.length} {needsAttention.length === 1 ? "lead" : "leads"}
            </Badge>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Todos os leads quentes têm interação recente
              </p>
            ) : (
              <div className="space-y-1">
                {needsAttention.map((l) => {
                  const lastSeen = l.last_interaction_at
                    ? formatDistanceToNow(parseISO(l.last_interaction_at), { locale: ptBR, addSuffix: true })
                    : "sem registro";
                  return (
                    <div
                      key={l.session_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => navigate(`/leads/${l.session_id}`)}
                    >
                      <Badge variant="outline" className="font-mono text-xs">#{l.session_id}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {l.service_desired || l.need_summary || `Lead #${l.session_id}`}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {normalizeChannel(l.channel)}
                          </Badge>
                          {l.sentiment && (
                            <Badge
                              variant={l.sentiment === "Positivo" ? "default" : l.sentiment === "Negativo" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {l.sentiment}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3" />
                          última interação {lastSeen}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-rose-500">{l.lead_score}</div>
                        <div className="text-[10px] text-muted-foreground">score</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </MagicBentoCard>
    </div>
  );
}
