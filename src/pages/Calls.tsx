import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import {
  FileText, Brain, Phone, PhoneIncoming, PhoneOutgoing, TrendingUp, TrendingDown,
  AlertTriangle, Smile, Frown, Meh, Target, Sparkles, Search, ArrowRightLeft,
} from "lucide-react";
import { getCallDirection, type CallDirection } from "@/lib/calls";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, previousResolved, type PeriodValue } from "@/lib/period";

/* ----------------- helpers ----------------- */
const SENTIMENT_COLORS: Record<string, string> = {
  Positivo: "#22c55e",
  Neutro: "#94a3b8",
  Negativo: "#ef4444",
};

const OBJECTION_LABELS: Record<string, string> = {
  preco: "Preço",
  tempo: "Tempo",
  distancia: "Distância",
  financiamento: "Financiamento",
  confianca: "Confiança",
  concorrencia: "Concorrência",
  tecnica: "Técnica",
  indecisao: "Indecisão",
};

const SCORE_BUCKETS = [
  { range: "0–20", min: 0, max: 20, color: "#ef4444" },
  { range: "20–40", min: 20, max: 40, color: "#f97316" },
  { range: "40–60", min: 40, max: 60, color: "#eab308" },
  { range: "60–80", min: 60, max: 80, color: "#84cc16" },
  { range: "80–100", min: 80, max: 101, color: "#22c55e" },
];

const scoreColor = (s: number | null | undefined) => {
  if (s == null) return "text-muted-foreground";
  if (s >= 70) return "text-green-500";
  if (s >= 40) return "text-yellow-500";
  return "text-red-500";
};

const sentimentIcon = (s?: string) => {
  if (s === "Positivo") return <Smile className="h-4 w-4 text-green-500" />;
  if (s === "Negativo") return <Frown className="h-4 w-4 text-red-500" />;
  return <Meh className="h-4 w-4 text-slate-400" />;
};

/* ----------------- page ----------------- */
export default function Calls() {
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  /* filters */
  const [period, setPeriod] = useState<PeriodValue>({ preset: "30" });
  const range = useMemo(() => resolvePeriod(period), [period]);
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [objectionFilter, setObjectionFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | CallDirection>("all");
  const [search, setSearch] = useState("");

  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_db")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  /* ----------------- filtered calls ----------------- */
  const filteredCalls = useMemo(() => {
    if (!calls) return [];

    return calls.filter((call: any) => {
      const a = call.ai_call_analysis || {};
      const ts = new Date(call.created_at);
      if (range.from !== null && ts < range.from) return false;
      if (range.to !== null && ts > range.to) return false;
      if (sentimentFilter !== "all" && a.sentiment !== sentimentFilter) return false;
      if (scoreFilter !== "all") {
        const s = a.quality_score;
        if (s == null) return false;
        if (scoreFilter === "high" && s < 70) return false;
        if (scoreFilter === "mid" && (s < 40 || s >= 70)) return false;
        if (scoreFilter === "low" && s >= 40) return false;
      }
      if (objectionFilter === "with" && !a.has_objection) return false;
      if (objectionFilter === "overcome" && !(a.has_objection && a.objection_overcome)) return false;
      if (objectionFilter === "not_overcome" && !(a.has_objection && a.objection_overcome === false)) return false;
      if (directionFilter !== "all" && getCallDirection(call) !== directionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${call.from_number || ""} ${call.to_number || ""} ${a.executive_summary || ""} ${(a.call_tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, range, sentimentFilter, scoreFilter, objectionFilter, directionFilter, search]);

  /* previous-period comparison (for delta) */
  const previousPeriodCalls = useMemo(() => {
    if (!calls) return [];
    const prev = previousResolved(range);
    if (!prev) return [];
    return calls.filter((c: any) => {
      const t = new Date(c.created_at);
      return t >= prev.from && t <= prev.to;
    });
  }, [calls, range]);

  /* ----------------- aggregates ----------------- */
  const stats = useMemo(() => {
    const total = filteredCalls.length;
    const analyzed = filteredCalls.filter((c: any) => c.ai_call_analysis);
    const analyzedCount = analyzed.length;

    const avgDuration = total
      ? Math.round(filteredCalls.reduce((acc: number, c: any) => acc + (c.call_duration || 0), 0) / total)
      : 0;

    const scores = analyzed
      .map((c: any) => c.ai_call_analysis?.quality_score)
      .filter((s: any) => typeof s === "number");
    const avgScore = scores.length
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    const sentimentCounts = { Positivo: 0, Neutro: 0, Negativo: 0 };
    analyzed.forEach((c: any) => {
      const s = c.ai_call_analysis?.sentiment;
      if (s && sentimentCounts[s as keyof typeof sentimentCounts] !== undefined) {
        sentimentCounts[s as keyof typeof sentimentCounts]++;
      }
    });
    const pctPositive = analyzedCount
      ? Math.round((sentimentCounts.Positivo / analyzedCount) * 100)
      : 0;

    const withObj = analyzed.filter((c: any) => c.ai_call_analysis?.has_objection).length;
    const pctObjection = analyzedCount ? Math.round((withObj / analyzedCount) * 100) : 0;
    const overcomeCount = analyzed.filter((c: any) => c.ai_call_analysis?.has_objection && c.ai_call_analysis?.objection_overcome).length;
    const pctOvercome = withObj ? Math.round((overcomeCount / withObj) * 100) : 0;

    const complianceScores = analyzed
      .map((c: any) => c.ai_call_analysis?.compliance_score)
      .filter((s: any) => typeof s === "number");
    const avgCompliance = complianceScores.length
      ? Math.round(complianceScores.reduce((a: number, b: number) => a + b, 0) / complianceScores.length)
      : null;

    const pctOffer = analyzedCount
      ? Math.round((analyzed.filter((c: any) => c.ai_call_analysis?.used_offer).length / analyzedCount) * 100)
      : 0;
    const pctAnchoring = analyzedCount
      ? Math.round((analyzed.filter((c: any) => c.ai_call_analysis?.used_anchoring).length / analyzedCount) * 100)
      : 0;

    /* delta vs previous period */
    const totalDelta = previousPeriodCalls.length
      ? Math.round(((total - previousPeriodCalls.length) / previousPeriodCalls.length) * 100)
      : null;

    /* direction breakdown */
    let activeCalls = 0;
    let passiveCalls = 0;
    let unknownDirCalls = 0;
    filteredCalls.forEach((c: any) => {
      const dir = getCallDirection(c);
      if (dir === "active") activeCalls++;
      else if (dir === "passive") passiveCalls++;
      else unknownDirCalls++;
    });
    const pctActive = total ? Math.round((activeCalls / total) * 100) : 0;
    const pctPassive = total ? Math.round((passiveCalls / total) * 100) : 0;

    /* score avg per direction */
    const scoresActive = analyzed
      .filter((c: any) => getCallDirection(c) === "active")
      .map((c: any) => c.ai_call_analysis?.quality_score)
      .filter((s: any) => typeof s === "number");
    const avgScoreActive = scoresActive.length
      ? Math.round(scoresActive.reduce((a: number, b: number) => a + b, 0) / scoresActive.length)
      : null;

    const scoresPassive = analyzed
      .filter((c: any) => getCallDirection(c) === "passive")
      .map((c: any) => c.ai_call_analysis?.quality_score)
      .filter((s: any) => typeof s === "number");
    const avgScorePassive = scoresPassive.length
      ? Math.round(scoresPassive.reduce((a: number, b: number) => a + b, 0) / scoresPassive.length)
      : null;

    /* direction-aware metrics from ai_call_analysis */
    const analyzedActive = analyzed.filter((c: any) => getCallDirection(c) === "active");
    const analyzedPassive = analyzed.filter((c: any) => getCallDirection(c) === "passive");

    // Active calls with weak opening (< 5/10)
    const activeWeakOpening = analyzedActive.filter((c: any) => {
      const o = c.ai_call_analysis?.opening_quality;
      return typeof o === "number" && o < 5;
    }).length;

    // Passive calls without close attempt
    const passiveNoClose = analyzedPassive.filter((c: any) => {
      const ca = c.ai_call_analysis?.close_attempt;
      return ca === false;
    }).length;

    // Average opening quality
    const openings = analyzed
      .map((c: any) => c.ai_call_analysis?.opening_quality)
      .filter((o: any) => typeof o === "number");
    const avgOpening = openings.length
      ? Math.round((openings.reduce((a: number, b: number) => a + b, 0) / openings.length) * 10) / 10
      : null;

    // Average direction_appropriate_score
    const adaptScores = analyzed
      .map((c: any) => c.ai_call_analysis?.direction_appropriate_score)
      .filter((s: any) => typeof s === "number");
    const avgAdaptScore = adaptScores.length
      ? Math.round((adaptScores.reduce((a: number, b: number) => a + b, 0) / adaptScores.length) * 10) / 10
      : null;

    // Active: % that asked permission
    const activeWithPermission = analyzedActive.filter((c: any) => c.ai_call_analysis?.permission_asked === true).length;
    const pctActivePermission = analyzedActive.length
      ? Math.round((activeWithPermission / analyzedActive.length) * 100)
      : 0;

    // % that attempted to close
    const totalCloseAttempts = analyzed.filter((c: any) => c.ai_call_analysis?.close_attempt === true).length;
    const pctCloseAttempt = analyzed.length
      ? Math.round((totalCloseAttempts / analyzed.length) * 100)
      : 0;

    return {
      total,
      analyzedCount,
      avgDuration,
      avgScore,
      sentimentCounts,
      pctPositive,
      pctObjection,
      pctOvercome,
      avgCompliance,
      pctOffer,
      pctAnchoring,
      totalDelta,
      activeCalls,
      passiveCalls,
      unknownDirCalls,
      pctActive,
      pctPassive,
      avgScoreActive,
      avgScorePassive,
      activeWeakOpening,
      passiveNoClose,
      avgOpening,
      avgAdaptScore,
      pctActivePermission,
      pctCloseAttempt,
      analyzedActiveCount: analyzedActive.length,
      analyzedPassiveCount: analyzedPassive.length,
    };
  }, [filteredCalls, previousPeriodCalls]);

  /* sentiment donut data */
  const sentimentChartData = useMemo(
    () => Object.entries(stats.sentimentCounts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value })),
    [stats.sentimentCounts]
  );

  /* score histogram */
  const scoreHistogram = useMemo(() => {
    const buckets = SCORE_BUCKETS.map((b) => ({ range: b.range, count: 0, color: b.color }));
    filteredCalls.forEach((c: any) => {
      const s = c.ai_call_analysis?.quality_score;
      if (typeof s !== "number") return;
      const idx = SCORE_BUCKETS.findIndex((b) => s >= b.min && s < b.max);
      if (idx >= 0) buckets[idx].count++;
    });
    return buckets;
  }, [filteredCalls]);

  /* score & volume per day */
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; volume: number; scoreSum: number; scoreN: number }> = {};
    filteredCalls.forEach((c: any) => {
      const d = new Date(c.created_at).toLocaleDateString("pt-BR");
      if (!map[d]) map[d] = { date: d, volume: 0, scoreSum: 0, scoreN: 0 };
      map[d].volume++;
      const s = c.ai_call_analysis?.quality_score;
      if (typeof s === "number") {
        map[d].scoreSum += s;
        map[d].scoreN++;
      }
    });
    return Object.values(map)
      .map((d) => ({ date: d.date, volume: d.volume, avgScore: d.scoreN ? Math.round(d.scoreSum / d.scoreN) : null }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [filteredCalls]);

  /* chamadas por hora do dia (hora de pico) */
  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, chamadas: 0 }));
    filteredCalls.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      if (h >= 0 && h < 24) buckets[h].chamadas++;
    });
    return buckets;
  }, [filteredCalls]);

  /* objection categories */
  const objectionStats = useMemo(() => {
    const counts: Record<string, { total: number; overcome: number }> = {};
    filteredCalls.forEach((c: any) => {
      const a = c.ai_call_analysis;
      if (!a?.has_objection || !Array.isArray(a.objection_categories)) return;
      a.objection_categories.forEach((cat: string) => {
        if (!counts[cat]) counts[cat] = { total: 0, overcome: 0 };
        counts[cat].total++;
        if (a.objection_overcome) counts[cat].overcome++;
      });
    });
    return Object.entries(counts)
      .map(([cat, v]) => ({
        category: OBJECTION_LABELS[cat] || cat,
        total: v.total,
        overcome: v.overcome,
        notOvercome: v.total - v.overcome,
        pctOvercome: v.total ? Math.round((v.overcome / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredCalls]);

  /* top 5 unhandled objections (most painful calls to learn from) */
  const topUnhandledObjections = useMemo(() => {
    return filteredCalls
      .filter((c: any) => c.ai_call_analysis?.has_objection && c.ai_call_analysis?.objection_overcome === false)
      .sort((a: any, b: any) => (a.ai_call_analysis?.quality_score || 0) - (b.ai_call_analysis?.quality_score || 0))
      .slice(0, 5);
  }, [filteredCalls]);

  /* top tags */
  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCalls.forEach((c: any) => {
      (c.ai_call_analysis?.call_tags || []).forEach((t: string) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [filteredCalls]);

  /* ----------------- UI helpers ----------------- */
  const getTranscriptionBadge = (status: string | null) => {
    switch (status) {
      case "completed": return <Badge variant="success">Transcrita</Badge>;
      case "processing": return <Badge variant="warning">Transcrevendo</Badge>;
      case "pending": return <Badge variant="secondary">Pendente</Badge>;
      case "failed": return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">N/A</Badge>;
    }
  };

  /* ----------------- render ----------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Chamadas</h2>
          <p className="text-muted-foreground">Análise detalhada de todas as chamadas</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sentimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos sentimentos</SelectItem>
              <SelectItem value="Positivo">Positivo</SelectItem>
              <SelectItem value="Neutro">Neutro</SelectItem>
              <SelectItem value="Negativo">Negativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Score" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos scores</SelectItem>
              <SelectItem value="high">Alto (≥70)</SelectItem>
              <SelectItem value="mid">Médio (40–70)</SelectItem>
              <SelectItem value="low">Baixo (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={objectionFilter} onValueChange={setObjectionFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Objeção" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas chamadas</SelectItem>
              <SelectItem value="with">Com objeção</SelectItem>
              <SelectItem value="overcome">Contornada</SelectItem>
              <SelectItem value="not_overcome">Não contornada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as "all" | CallDirection)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Direção" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas direções</SelectItem>
              <SelectItem value="active">Ativas (saída)</SelectItem>
              <SelectItem value="passive">Passivas (entrada)</SelectItem>
              <SelectItem value="unknown">— Não identificadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 9 KPIs */}
      <MagicBentoGrid className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5" glowColor="59, 130, 246">
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2">Total de Chamadas <ChartInfoTooltip description="Quantidade total de chamadas no período e filtros selecionados, com a variação % vs. o período anterior." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Conta todas as chamadas (analisadas ou não)." calculation="Conta todas as chamadas que passam pelos filtros ativos. A variação compara esse total com o nº de chamadas do período imediatamente anterior." /></CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              {stats.totalDelta !== null && (
                <div className={`text-xs flex items-center gap-1 ${stats.totalDelta >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {stats.totalDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stats.totalDelta > 0 ? "+" : ""}{stats.totalDelta}% vs período anterior
                </div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />Direção
                <ChartInfoTooltip description="Divide as chamadas entre ativas (vendedor ligou) e passivas (cliente ligou), com o nº de cada uma e o % do total." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Direção definida comparando os números de origem/destino com o telefone da empresa." calculation="Para cada chamada, compara from_number/to_number com o número da empresa: se a origem é a empresa = ativa; se o destino é a empresa = passiva; senão, sem id. O % é cada grupo sobre o total." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <div className="flex items-center gap-1.5" title="Ativas: vendedor ligou">
                  <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                  <span className="text-xl font-bold text-blue-500">{stats.activeCalls}</span>
                </div>
                <span className="text-muted-foreground/40">/</span>
                <div className="flex items-center gap-1.5" title="Passivas: cliente ligou">
                  <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                  <span className="text-xl font-bold text-emerald-500">{stats.passiveCalls}</span>
                </div>
              </div>
              <div className="flex h-1.5 mt-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-blue-500" style={{ width: `${stats.pctActive}%` }} />
                <div className="bg-emerald-500" style={{ width: `${stats.pctPassive}%` }} />
                <div className="bg-muted-foreground/30 flex-1" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.pctActive}% ativas • {stats.pctPassive}% passivas
                {stats.unknownDirCalls > 0 && ` • ${stats.unknownDirCalls} sem id`}
              </div>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2">Score Médio <ChartInfoTooltip description="Nota média de qualidade (0–100) das chamadas analisadas pela IA no período." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com ai_call_analysis.quality_score numérico preenchido." calculation="Média aritmética dos quality_score das chamadas analisadas, arredondada. O subtítulo mostra quantas chamadas têm análise." /></CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${scoreColor(stats.avgScore)}`}>{stats.avgScore || "—"}</div>
              <div className="text-xs text-muted-foreground">{stats.analyzedCount} analisadas</div>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Smile className="h-3 w-3 text-green-500" />% Positivo <ChartInfoTooltip description="Percentual das chamadas analisadas cujo sentimento foi classificado como Positivo pela IA." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com ai_call_analysis.sentiment preenchido." calculation="(chamadas com sentiment = Positivo ÷ total de chamadas analisadas) × 100." /></CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pctPositive}%</div>
              <div className="text-xs text-muted-foreground">{stats.sentimentCounts.Positivo} chamadas positivas</div>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2">Duração Média <ChartInfoTooltip description="Tempo médio de duração das chamadas do período, em segundos (e aproximado em minutos)." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Usa o campo call_duration de todas as chamadas do período (não só as analisadas)." calculation="Média do call_duration de todas as chamadas filtradas, arredondada. O subtítulo converte para minutos (segundos ÷ 60)." /></CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration}s</div>
              <div className="text-xs text-muted-foreground">≈ {Math.round(stats.avgDuration / 60)}min</div>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-orange-500" />Com Objeção <ChartInfoTooltip description="Percentual das chamadas analisadas em que a IA identificou alguma objeção do cliente." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com ai_call_analysis e o campo has_objection." calculation="(chamadas com has_objection = true ÷ total de chamadas analisadas) × 100." /></CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pctObjection}%</div>
              <Progress value={stats.pctObjection} className="h-1 mt-1" />
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-3 w-3 text-green-500" />Contornadas <ChartInfoTooltip description="Das chamadas que tiveram objeção, o percentual em que o vendedor conseguiu contorná-la." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com has_objection = true." calculation="(chamadas com has_objection e objection_overcome = true ÷ chamadas com objeção) × 100. A base é só as chamadas com objeção, não o total." /></CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${scoreColor(stats.pctOvercome)}`}>{stats.pctOvercome}%</div>
              <Progress value={stats.pctOvercome} className="h-1 mt-1" />
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2">Compliance Médio <ChartInfoTooltip description="Nota média de aderência ao playbook (0–100) das chamadas analisadas pela IA." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com ai_call_analysis.compliance_score numérico preenchido." calculation="Média aritmética dos compliance_score das chamadas analisadas, arredondada. Mostra — quando nenhuma chamada tem o campo." /></CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${scoreColor(stats.avgCompliance ?? undefined)}`}>
                {stats.avgCompliance ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">aderência ao playbook</div>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-3 w-3 text-purple-500" />Usou Oferta <ChartInfoTooltip description="Percentual das chamadas analisadas em que o vendedor apresentou uma oferta; o subtítulo traz o % que usou ancoragem de preço." source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo. Considera apenas chamadas com ai_call_analysis (campos used_offer e used_anchoring)." calculation="Oferta = (chamadas com used_offer = true ÷ analisadas) × 100. Ancoragem = (chamadas com used_anchoring = true ÷ analisadas) × 100." /></CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pctOffer}%</div>
              <div className="text-xs text-muted-foreground">{stats.pctAnchoring}% com ancoragem</div>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </MagicBentoGrid>

      {/* Visão Geral: 3 charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2">Distribuição de Sentimentos <ChartInfoTooltip description="Mostra a divisão das chamadas analisadas entre os sentimentos Positivo, Neutro e Negativo." source="Chamadas registradas via Twilio e analisadas por IA (campo ai_call_analysis). Não vem da Kommo. Considera apenas chamadas com análise concluída e com o campo sentiment preenchido." calculation="Conta quantas chamadas há em cada sentimento (ai_call_analysis.sentiment) e mostra a fatia de cada um no total." /></CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              {sentimentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sentimentChartData.map((entry, i) => (
                        <Cell key={i} fill={SENTIMENT_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2">Distribuição de Scores <ChartInfoTooltip description="Eixo X = faixas de score de qualidade (0–20 até 80–100); barra = nº de chamadas em cada faixa." source="Chamadas registradas via Twilio e analisadas por IA (campo ai_call_analysis). Não vem da Kommo. Considera apenas chamadas com quality_score numérico preenchido." calculation="Cada chamada é alocada na faixa do seu quality_score (ai_call_analysis.quality_score) e conta-se quantas caem em cada faixa." /></CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreHistogram}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreHistogram.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2">Volume & Score por Dia <ChartInfoTooltip description="Eixo X = dias; linha azul = volume de chamadas no dia; linha verde = score médio do dia (escala 0–100)." source="Chamadas registradas via Twilio e analisadas por IA (campo ai_call_analysis). Não vem da Kommo. Agrupa todas as chamadas do período por dia de created_at; o score só usa chamadas com quality_score preenchido." calculation="Por dia: volume = nº de chamadas; score médio = média dos quality_score das chamadas analisadas daquele dia." /></CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="volume" name="Volume" stroke="#3b82f6" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Score médio" stroke="#22c55e" strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Chamadas por hora */}
      <MagicBentoCard glowColor="139, 92, 246">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="flex items-center gap-2">Chamadas por hora <ChartInfoTooltip description="Eixo X = horas do dia (0h–23h); a barra mostra quantas chamadas aconteceram em cada hora, revelando os horários de pico de ligação." source="Chamadas registradas via Twilio (tabela call_db); não vem da Kommo. Agrupa todas as chamadas do período pela hora do created_at." calculation="Para cada hora do dia, conta as chamadas cujo created_at cai naquela hora (somando todos os dias do período)." /></CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="chamadas" name="Chamadas" fill="rgb(139, 92, 246)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </MagicBentoCard>

      {/* Objeções */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <MagicBentoCard glowColor="59, 130, 246">
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Categorias de Objeção <ChartInfoTooltip description="Barras horizontais por tipo de objeção (preço, tempo, etc.), divididas entre objeções contornadas (verde) e não contornadas (vermelho)." source="Chamadas registradas via Twilio e analisadas por IA (campo ai_call_analysis). Não vem da Kommo. Considera apenas chamadas com has_objection e com objection_categories preenchido." calculation="Para cada categoria em ai_call_analysis.objection_categories, conta o total e quantas tiveram objection_overcome = true (contornadas); o restante é não contornadas." /></CardTitle>
              <p className="text-xs text-muted-foreground">% de contorno por tipo — identifique onde o time precisa treinar</p>
            </CardHeader>
            <CardContent className="h-[320px]">
              {objectionStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={objectionStats} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="category" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="overcome" name="Contornada" stackId="a" fill="#22c55e" />
                    <Bar dataKey="notOvercome" name="Não contornada" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhuma objeção identificada no período</div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard glowColor="239, 68, 68">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Top 5: Objeções Não Contornadas</CardTitle>
              <p className="text-xs text-muted-foreground">Casos para revisar com o time</p>
            </CardHeader>
            <CardContent>
              {topUnhandledObjections.length > 0 ? (
                <div className="space-y-2">
                  {topUnhandledObjections.map((c: any) => (
                    <button
                      key={c.call_id}
                      onClick={() => { setSelectedCall(c); setShowAnalysis(true); }}
                      className="w-full text-left p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                        <Badge variant="destructive" className="text-xs">Score {c.ai_call_analysis?.quality_score ?? "—"}</Badge>
                      </div>
                      <p className="text-xs line-clamp-2">{c.ai_call_analysis?.objection_detail || "Sem detalhe"}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">Nenhuma objeção não-contornada</div>
              )}
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Ativas vs Passivas — performance comparativa */}
      <MagicBentoCard glowColor="14, 165, 233">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-cyan-500" />
              Ativas vs Passivas
              <ChartInfoTooltip
                description="Compara a performance de chamadas ativas (saída — vendedor liga) vs passivas (entrada — cliente liga): score médio, % do total, pediu permissão, tentou fechar, abertura média e adaptação à direção da chamada."
                source="Chamadas do call_db (Twilio + análise de IA). Independe da Kommo."
                calculation="Direção inferida de cada chamada (ativa/passiva); para cada grupo calcula score médio, participação no total, % que pediu permissão / tentou fechar, e nas métricas gerais a abertura média e a adaptação à direção (notas 0–10 da IA), tudo sobre as chamadas analisadas do período."
              />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Auditoria de quem performa melhor — vendedor ligando ou recebendo
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* ATIVAS */}
              <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneOutgoing className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold">Ativas (saída)</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stats.activeCalls} chamadas</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Score</div>
                    <div className={`text-2xl font-bold ${scoreColor(stats.avgScoreActive ?? undefined)}`}>
                      {stats.avgScoreActive ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">% total</div>
                    <div className="text-2xl font-bold text-blue-500">{stats.pctActive}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Pediu permissão</div>
                    <div className="text-2xl font-bold">{stats.pctActivePermission}%</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-500/10 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      Abertura fraca (&lt;5/10)
                    </span>
                    <span className={`font-semibold ${stats.activeWeakOpening > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                      {stats.activeWeakOpening} / {stats.analyzedActiveCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* PASSIVAS */}
              <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="h-5 w-5 text-emerald-500" />
                    <span className="font-semibold">Passivas (entrada)</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stats.passiveCalls} chamadas</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Score</div>
                    <div className={`text-2xl font-bold ${scoreColor(stats.avgScorePassive ?? undefined)}`}>
                      {stats.avgScorePassive ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">% total</div>
                    <div className="text-2xl font-bold text-emerald-500">{stats.pctPassive}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Tentou fechar</div>
                    <div className="text-2xl font-bold">{stats.pctCloseAttempt}%</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-500/10 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      Sem tentativa de fechamento
                    </span>
                    <span className={`font-semibold ${stats.passiveNoClose > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {stats.passiveNoClose} / {stats.analyzedPassiveCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cross-cutting metrics */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mt-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Abertura média (geral)</div>
                <div className={`text-xl font-bold ${stats.avgOpening !== null && stats.avgOpening >= 7 ? "text-green-500" : stats.avgOpening !== null && stats.avgOpening >= 5 ? "text-yellow-500" : "text-red-500"}`}>
                  {stats.avgOpening ?? "—"}<span className="text-sm text-muted-foreground">/10</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Adaptação à direção</div>
                <div className={`text-xl font-bold ${stats.avgAdaptScore !== null && stats.avgAdaptScore >= 7 ? "text-green-500" : stats.avgAdaptScore !== null && stats.avgAdaptScore >= 5 ? "text-yellow-500" : "text-red-500"}`}>
                  {stats.avgAdaptScore ?? "—"}<span className="text-sm text-muted-foreground">/10</span>
                </div>
                <div className="text-[10px] text-muted-foreground">vendedor ajustou tom ao tipo?</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Tentou fechar (qualquer)</div>
                <div className="text-xl font-bold">{stats.pctCloseAttempt}%</div>
                <div className="text-[10px] text-muted-foreground">% chamadas com tentativa</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </MagicBentoCard>

      {/* Tags */}
      {topTags.length > 0 && (
        <MagicBentoCard glowColor="139, 92, 246">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>Tags Mais Frequentes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag} <span className="ml-1 opacity-60">×{count}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </MagicBentoCard>
      )}

      {/* Tabela */}
      <MagicBentoCard glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Lista de Chamadas <span className="text-sm font-normal text-muted-foreground">({filteredCalls.length})</span></CardTitle>
              <div className="relative w-[280px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, resumo, tag…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Carregando...</div>
            ) : filteredCalls.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direção</TableHead>
                      <TableHead>De / Para</TableHead>
                      <TableHead>Sent.</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Transcrição</TableHead>
                      <TableHead>Análise</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Objeção</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.map((call: any) => {
                      const a = call.ai_call_analysis || {};
                      const direction = getCallDirection(call);
                      return (
                        <TableRow key={call.call_id}>
                          <TableCell>
                            {direction === "active" ? (
                              <Badge variant="outline" className="text-xs gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400">
                                <PhoneOutgoing className="h-3 w-3" />Ativa
                              </Badge>
                            ) : direction === "passive" ? (
                              <Badge variant="outline" className="text-xs gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                <PhoneIncoming className="h-3 w-3" />Passiva
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />—
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {call.from_number ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1"><PhoneOutgoing className="h-3 w-3" />{call.from_number}</div>
                                <div className="flex items-center gap-1"><PhoneIncoming className="h-3 w-3" />{call.to_number || "N/A"}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>{sentimentIcon(a.sentiment)}</TableCell>
                          <TableCell>{call.call_duration || 0}s</TableCell>
                          <TableCell>{getTranscriptionBadge(call.transcription_status)}</TableCell>
                          <TableCell>
                            <Badge variant={call.ai_analysis_status === "completed" ? "success" : "secondary"}>
                              {call.ai_analysis_status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${scoreColor(a.quality_score)}`}>
                              {a.quality_score ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {a.has_objection ? (
                              a.objection_overcome
                                ? <Badge variant="success" className="text-xs">Contornada</Badge>
                                : <Badge variant="destructive" className="text-xs">Não contornada</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{new Date(call.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {call.transcription_text && (
                                <Button variant="ghost" size="sm" onClick={() => { setSelectedCall(call); setShowTranscription(true); }} title="Ver Transcrição">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                              {call.ai_call_analysis && (
                                <Button variant="ghost" size="sm" onClick={() => { setSelectedCall(call); setShowAnalysis(true); }} title="Ver Análise IA">
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
              <div className="text-center py-8 text-muted-foreground">Nenhuma chamada encontrada com os filtros atuais</div>
            )}
          </CardContent>
        </Card>
      </MagicBentoCard>

      {/* Transcription Dialog */}
      <Dialog open={showTranscription} onOpenChange={setShowTranscription}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Transcrição da Chamada</DialogTitle>
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
            <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Análise de IA da Chamada</DialogTitle>
            <DialogDescription>Resultado da análise automatizada</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            {selectedCall?.ai_call_analysis ? (() => {
              const a = selectedCall.ai_call_analysis;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Qualidade</p><p className={`text-2xl font-bold ${scoreColor(a.quality_score)}`}>{a.quality_score || "N/A"}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Sentimento</p><p className="text-lg font-semibold flex items-center justify-center gap-2">{sentimentIcon(a.sentiment)}{a.sentiment || "N/A"}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Compliance</p><p className={`text-2xl font-bold ${scoreColor(a.compliance_score)}`}>{a.compliance_score ?? "N/A"}</p></CardContent></Card>
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
