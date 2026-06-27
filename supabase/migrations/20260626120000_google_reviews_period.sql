-- 2026-06-26: Avaliações do Google POR PERÍODO (liga o card "Avaliações Google" ao
-- PeriodFilter padrão do dashboard). A Places API (New) só entrega o TOTAL acumulado
-- (userRatingCount) — ela NÃO expõe o histórico de avaliações por data. Então "quantas
-- avaliações entraram no período" é DERIVADO dos snapshots diários (google_reviews_snapshot):
--
--   novas no período = total no fim do período − total imediatamente antes do início.
--
-- Limites comparados por `captured_at` (timestamptz) para casar com date_from/date_to
-- já resolvidos em UTC pelo resolvePeriod() — sem ambiguidade de fuso.
--
-- Honestidade do dado: se o período COMEÇA antes do 1º snapshot que coletamos, não há
-- baseline e devolvemos period_count = NULL (o card mostra "histórico desde DD/MM" em vez
-- de fingir que todas as avaliações são do período). first_snapshot_at vai junto pra isso.
-- Mantém get_google_reviews() (sem args) intacta para back-compat.

CREATE OR REPLACE FUNCTION public.get_google_reviews_period(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  place_id          text,
  place_name        text,
  rating            numeric,
  review_count      integer,      -- total acumulado ATUAL (snapshot mais recente)
  captured_at       timestamptz,  -- quando o total atual foi medido
  period_count      integer,      -- novas avaliações dentro de [date_from, date_to];
                                  --   NULL  => sem baseline (período antes do 1º snapshot)
                                  --   N>=0  => total(fim) − total(antes do início)
  first_snapshot_at timestamptz   -- 1ª medição que temos (limite do que dá pra calcular)
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT * FROM public.google_reviews_snapshot
    ORDER BY captured_at DESC
    LIMIT 1
  ),
  -- total no FIM do período: último snapshot até date_to (sem teto => o atual).
  end_snap AS (
    SELECT s.review_count
    FROM public.google_reviews_snapshot s, latest l
    WHERE s.place_id = l.place_id
      AND (date_to IS NULL OR s.captured_at <= date_to)
    ORDER BY s.captured_at DESC
    LIMIT 1
  ),
  -- BASELINE: total imediatamente ANTES do início do período. Se date_from é NULL
  -- (preset "Todos") ou não há snapshot anterior, fica vazio (sem baseline).
  base_snap AS (
    SELECT s.review_count
    FROM public.google_reviews_snapshot s, latest l
    WHERE s.place_id = l.place_id
      AND date_from IS NOT NULL
      AND s.captured_at < date_from
    ORDER BY s.captured_at DESC
    LIMIT 1
  ),
  first_snap AS (
    SELECT MIN(captured_at) AS first_at FROM public.google_reviews_snapshot
  )
  SELECT
    l.place_id,
    l.place_name,
    l.rating,
    l.review_count,
    l.captured_at,
    CASE
      -- "Todos": todas as avaliações são do período => o próprio total acumulado.
      WHEN date_from IS NULL THEN l.review_count
      -- Período começa antes do 1º snapshot: baseline desconhecido => honesto NULL.
      WHEN (SELECT review_count FROM base_snap) IS NULL THEN NULL
      -- Caso normal: variação líquida no período (clamp em 0 se houve remoção).
      ELSE GREATEST(
             COALESCE((SELECT review_count FROM end_snap), l.review_count)
               - (SELECT review_count FROM base_snap),
             0)
    END AS period_count,
    (SELECT first_at FROM first_snap) AS first_snapshot_at
  FROM latest l;
$$;

GRANT EXECUTE ON FUNCTION public.get_google_reviews_period(timestamptz, timestamptz) TO anon, authenticated;
