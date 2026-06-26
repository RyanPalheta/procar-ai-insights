import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, ExternalLink, History } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoogleReviewsPeriod {
  place_id: string;
  place_name: string | null;
  rating: number | null;
  review_count: number;
  captured_at: string;
  /** novas avaliações dentro do período selecionado; null = sem baseline (período antes do 1º snapshot) */
  period_count: number | null;
  /** 1ª medição que temos — limite do que dá pra calcular por período */
  first_snapshot_at: string | null;
}

interface GoogleReviewsCardProps {
  /** ISO do início do período (null = "Todos") */
  dateFrom: string | null;
  /** ISO do fim do período (null = "Todos") */
  dateTo: string | null;
  /** rótulo do período selecionado (ex.: "Últimos 7 dias", "Ontem") */
  periodLabel: string;
}

// Renderiza 5 estrelas com preenchimento proporcional à nota (ex.: 4.9 → 4 cheias + 90%).
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i)); // 0..1 desta estrela
        return (
          <div key={i} className="relative h-4 w-4">
            <Star className="absolute h-4 w-4 text-muted-foreground/30" />
            <div className="absolute overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Avaliações Google — reputação ao vivo da loja no Google Maps (total de avaliações +
 * nota), com quantas avaliações novas entraram no PERÍODO selecionado no dashboard.
 *
 * A Places API (New) só entrega o total acumulado (userRatingCount) — não há histórico
 * de avaliações por data. Então "novas no período" é derivado dos snapshots diários
 * (get_google_reviews_period): total no fim − total imediatamente antes do início. Quando
 * o período começa antes do 1º snapshot (11/06), não há baseline e mostramos "histórico
 * desde DD/MM" em vez de um número enganoso.
 */
export function GoogleReviewsCard({ dateFrom, dateTo, periodLabel }: GoogleReviewsCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["google-reviews-period", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_google_reviews_period", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      const rows = (data as GoogleReviewsPeriod[]) || [];
      return rows[0] ?? null;
    },
  });

  // "Todos" (sem limites) mostra só o total acumulado — não faz sentido um badge de variação.
  const isAllTime = !dateFrom;
  const newInPeriod = data?.period_count ?? null;

  return (
    <Card>
      <CardContent className="px-4 py-2.5">
        {isLoading ? (
          <Skeleton className="h-7 w-full" />
        ) : !data ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">Avaliações Google</span>
            <span>
              — sem dados ainda. Configure <code className="font-mono text-xs">GOOGLE_PLACES_API_KEY</code> e rode{" "}
              <code className="font-mono text-xs">sync-google-reviews</code>.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold flex items-center gap-1.5">
                Avaliações Google
                <ChartInfoTooltip
                  description="Total de avaliações e nota média da loja no Google Maps. O destaque mostra quantas avaliações novas entraram no período selecionado. Atualizado diariamente."
                  source="Google Places API (New) — contagem oficial do Google (userRatingCount + rating). Sincronizada 1x/dia pela edge function sync-google-reviews; guardamos um snapshot por dia para calcular a variação por período."
                  calculation="Total = userRatingCount do Google (snapshot mais recente). Novas no período = total no fim do período − total imediatamente antes do início (derivado dos snapshots diários). Sem snapshot antes do início do período, a contagem fica indisponível (mostramos desde quando há histórico)."
                />
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums leading-none">
                {Number(data.review_count).toLocaleString("en-US")}
              </span>
              <span className="text-xs text-muted-foreground">avaliações</span>
            </div>

            {data.rating != null && (
              <div className="flex items-center gap-1.5">
                <Stars rating={Number(data.rating)} />
                <span className="text-sm font-medium">{Number(data.rating).toFixed(1)}</span>
              </div>
            )}

            {/* Novas no período: só para períodos delimitados (não "Todos") e com baseline. */}
            {!isAllTime && newInPeriod != null && newInPeriod > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                +{newInPeriod.toLocaleString("en-US")} · {periodLabel}
              </span>
            )}

            {/* Período começa antes do 1º snapshot: não dá pra contar — somos honestos. */}
            {!isAllTime && newInPeriod == null && data.first_snapshot_at && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                title="Só registramos a contagem de avaliações a partir desta data — períodos anteriores não têm base de comparação."
              >
                <History className="h-3.5 w-3.5" />
                Histórico desde {format(parseISO(data.first_snapshot_at), "dd/MM", { locale: ptBR })}
              </span>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Atualizado {formatDistanceToNow(new Date(data.captured_at), { addSuffix: true, locale: ptBR })}
              </span>
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${data.place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver no Google <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
