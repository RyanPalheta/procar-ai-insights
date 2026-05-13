import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Sparkles,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Star,
  AlertTriangle,
  Gift,
  Anchor,
  Lightbulb,
  TrendingUp,
  FileText,
  Volume2,
  Loader2,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Tag,
} from "lucide-react";

type AiAnalysis = {
  sentiment?: "Positivo" | "Neutro" | "Negativo" | string;
  quality_score?: number;
  executive_summary?: string;
  improvement_points?: string[];
  has_objection?: boolean;
  objection_detail?: string | null;
  objection_categories?: string[];
  objection_overcome?: boolean | null;
  compliance_score?: number | null;
  compliance_notes?: string | null;
  used_offer?: boolean;
  offer_detail?: string | null;
  used_anchoring?: boolean;
  anchoring_detail?: string | null;
  sales_opportunities?: string[];
  call_tags?: string[];
};

type CallRow = {
  call_id: string;
  session_id: number;
  type?: string | null;
  call_status?: string | null;
  call_direction?: string | null;
  call_duration?: number | null;
  call_tag?: string | null;
  call_result?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  recording_url?: string | null;
  transcription_text?: string | null;
  transcription_status?: string | null;
  ai_analysis_status?: string | null;
  ai_call_analysis?: AiAnalysis | null;
  created_at: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────
const formatDuration = (seconds?: number | null) => {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const scoreColor = (score: number) =>
  score >= 80 ? "text-green-600 dark:text-green-400"
  : score >= 50 ? "text-yellow-600 dark:text-yellow-400"
  : "text-red-600 dark:text-red-400";

const scoreProgressClass = (score: number) =>
  score >= 80 ? "[&>div]:bg-green-500"
  : score >= 50 ? "[&>div]:bg-yellow-500"
  : "[&>div]:bg-red-500";

const SentimentIcon = ({ sentiment }: { sentiment?: string }) => {
  const s = sentiment?.toLowerCase();
  if (s === "positivo" || s === "positive")
    return <ThumbsUp className="h-4 w-4 text-green-500" />;
  if (s === "negativo" || s === "negative")
    return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

// ── component ────────────────────────────────────────────────────────────────
export default function CallCard({ call }: { call: CallRow }) {
  const [open, setOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const analysis = (call.ai_call_analysis || {}) as AiAnalysis;
  const isInbound = call.call_direction === "inbound" || call.call_status === "inbound";
  const transcriptStatus = call.transcription_status || "pending";
  const analysisStatus = call.ai_analysis_status || "pending";
  const isAnalyzed = analysisStatus === "completed";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden transition-colors hover:border-primary/30">
        {/* ── Header (always visible) ─────────────────────────────────────── */}
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Left: direction + numbers + meta */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isInbound ? "bg-blue-500/10" : "bg-emerald-500/10"
                }`}>
                  {isInbound ? (
                    <PhoneIncoming className="h-5 w-5 text-blue-500" />
                  ) : (
                    <PhoneOutgoing className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {isInbound ? "Recebida" : "Realizada"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {call.from_number || "—"} → {call.to_number || "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(call.created_at).toLocaleString("pt-BR")}
                    </span>
                    <span>·</span>
                    <span>{formatDuration(call.call_duration)}</span>
                  </div>
                </div>
              </div>

              {/* Right: status + score */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Transcription status */}
                <Badge
                  variant="outline"
                  className={
                    transcriptStatus === "completed"
                      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                      : transcriptStatus === "failed"
                      ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {transcriptStatus === "completed"
                    ? "Transcrita"
                    : transcriptStatus === "failed"
                    ? "Falha"
                    : "Aguardando"}
                </Badge>

                {/* AI analysis status */}
                <Badge
                  variant="outline"
                  className={
                    isAnalyzed
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                      : analysisStatus === "processing"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                      : analysisStatus === "failed"
                      ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {analysisStatus === "processing" ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {isAnalyzed
                    ? "Analisada"
                    : analysisStatus === "processing"
                    ? "Analisando"
                    : analysisStatus === "failed"
                    ? "Falha IA"
                    : "Pendente"}
                </Badge>

                {/* Quality score + sentiment (only when analyzed) */}
                {isAnalyzed && analysis.quality_score !== undefined && (
                  <Badge
                    className={`${
                      analysis.quality_score >= 80
                        ? "bg-green-500 hover:bg-green-600"
                        : analysis.quality_score >= 50
                        ? "bg-yellow-500 hover:bg-yellow-600"
                        : "bg-red-500 hover:bg-red-600"
                    } text-white`}
                  >
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {analysis.quality_score}/100
                  </Badge>
                )}
                {isAnalyzed && analysis.sentiment && (
                  <span title={`Sentimento: ${analysis.sentiment}`}>
                    <SentimentIcon sentiment={analysis.sentiment} />
                  </span>
                )}

                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* ── Body (expanded) ──────────────────────────────────────────────── */}
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-5 pb-5">
            <Separator />

            {/* Audio player */}
            {call.recording_url && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Gravação
                  </span>
                </div>
                <audio
                  controls
                  className="w-full h-10"
                  src={call.recording_url}
                  preload="none"
                >
                  Seu navegador não suporta áudio.
                </audio>
              </div>
            )}

            {/* AI analysis — only show if analyzed */}
            {isAnalyzed ? (
              <>
                {/* Executive summary */}
                {analysis.executive_summary && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        Resumo da IA
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {analysis.executive_summary}
                    </p>
                  </div>
                )}

                {/* Scores grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.quality_score !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Qualidade da Chamada
                        </label>
                        <span
                          className={`text-lg font-bold ${scoreColor(
                            analysis.quality_score
                          )}`}
                        >
                          {analysis.quality_score}%
                        </span>
                      </div>
                      <Progress
                        value={analysis.quality_score}
                        className={`h-2 ${scoreProgressClass(
                          analysis.quality_score
                        )}`}
                      />
                    </div>
                  )}

                  {analysis.compliance_score !== null &&
                    analysis.compliance_score !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <ClipboardCheck className="h-3 w-3" />
                            Aderência ao Playbook
                          </label>
                          <span
                            className={`text-lg font-bold ${scoreColor(
                              analysis.compliance_score
                            )}`}
                          >
                            {analysis.compliance_score}%
                          </span>
                        </div>
                        <Progress
                          value={analysis.compliance_score}
                          className={`h-2 ${scoreProgressClass(
                            analysis.compliance_score
                          )}`}
                        />
                        {analysis.compliance_notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {analysis.compliance_notes}
                          </p>
                        )}
                      </div>
                    )}
                </div>

                {/* Call tags */}
                {analysis.call_tags && analysis.call_tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {analysis.call_tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Objection */}
                {analysis.has_objection && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-medium text-sm">Objeção</span>
                          {analysis.objection_overcome !== null &&
                            analysis.objection_overcome !== undefined && (
                              <Badge
                                className={
                                  analysis.objection_overcome
                                    ? "bg-green-500 text-white hover:bg-green-600"
                                    : "bg-red-500 text-white hover:bg-red-600"
                                }
                              >
                                {analysis.objection_overcome
                                  ? "Contornada"
                                  : "Não Contornada"}
                              </Badge>
                            )}
                          {analysis.objection_categories?.map((cat, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                        {analysis.objection_detail && (
                          <p className="text-sm italic text-muted-foreground">
                            "{analysis.objection_detail}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sales strategies */}
                {(analysis.used_offer !== undefined ||
                  analysis.used_anchoring !== undefined) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Gift className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Oferta</span>
                        <Badge
                          variant="secondary"
                          className={
                            analysis.used_offer
                              ? "bg-green-500 text-white hover:bg-green-600 text-xs"
                              : "text-xs"
                          }
                        >
                          {analysis.used_offer ? "Usou" : "Não usou"}
                        </Badge>
                      </div>
                      {analysis.offer_detail && (
                        <p className="text-xs italic text-muted-foreground mt-1">
                          "{analysis.offer_detail}"
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Anchor className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">
                          Ancoragem de Preço
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            analysis.used_anchoring
                              ? "bg-blue-500 text-white hover:bg-blue-600 text-xs"
                              : "text-xs"
                          }
                        >
                          {analysis.used_anchoring ? "Usou" : "Não usou"}
                        </Badge>
                      </div>
                      {analysis.anchoring_detail && (
                        <p className="text-xs italic text-muted-foreground mt-1">
                          "{analysis.anchoring_detail}"
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Improvement points + Sales opportunities */}
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.improvement_points &&
                    analysis.improvement_points.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Lightbulb className="h-3 w-3 text-yellow-500" />
                          Pontos de Melhoria
                        </label>
                        <ul className="space-y-1">
                          {analysis.improvement_points.map((point, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm p-2 rounded-md bg-yellow-500/5 border border-yellow-500/20"
                            >
                              <XCircle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {analysis.sales_opportunities &&
                    analysis.sales_opportunities.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          Oportunidades de Venda
                        </label>
                        <ul className="space-y-1">
                          {analysis.sales_opportunities.map((opp, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span>{opp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </>
            ) : analysisStatus === "processing" ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando a chamada com IA…
              </div>
            ) : analysisStatus === "failed" ? (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Falha ao analisar esta chamada.
              </div>
            ) : !call.transcription_text ? (
              <div className="rounded-lg bg-muted/30 border p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4" />
                Aguardando transcrição para iniciar análise da IA.
              </div>
            ) : (
              <div className="rounded-lg bg-muted/30 border p-4 text-sm text-muted-foreground">
                Esta chamada ainda não foi analisada.
              </div>
            )}

            {/* Transcription (collapsible) */}
            {call.transcription_text && (
              <Collapsible
                open={showTranscript}
                onOpenChange={setShowTranscript}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcrição completa
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showTranscript ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="rounded-lg bg-muted/30 border p-4 max-h-80 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {call.transcription_text}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
