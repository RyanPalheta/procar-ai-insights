import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoogleReviews {
  place_id: string;
  place_name: string | null;
  rating: number | null;
  review_count: number;
  captured_at: string;
  count_7d_ago: number | null;
  count_30d_ago: number | null;
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
 * nota), com a variação de novas avaliações nos últimos 7 dias. Dados puxados pela
 * Places API (New) via edge function sync-google-reviews (snapshot diário).
 */
export function GoogleReviewsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["google-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_google_reviews");
      if (error) throw error;
      const rows = (data as GoogleReviews[]) || [];
      return rows[0] ?? null;
    },
  });

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
                  description="Total de avaliações e nota média da loja no Google Maps, com quantas avaliações novas entraram nos últimos 7 dias. Atualizado diariamente."
                  source="Google Places API (New) — contagem oficial do Google (userRatingCount + rating). Sincronizada 1x/dia pela edge function sync-google-reviews; guardamos um snapshot por dia para calcular a variação."
                  calculation="Total = userRatingCount do Google. Novas (7d) = total atual − total do snapshot de ~7 dias atrás."
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

            {data.count_7d_ago != null && data.review_count - data.count_7d_ago > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                +{(data.review_count - data.count_7d_ago).toLocaleString("en-US")} em 7 dias
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
