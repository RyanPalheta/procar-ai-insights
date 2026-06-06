-- 2026-06-06: Avaliações do Google Maps (reputação ao vivo da loja no Visão Geral).
-- A contagem REAL de avaliações + nota vem da Google Places API (New), puxada pela
-- edge function sync-google-reviews. Guardamos um SNAPSHOT por dia (place_id+dia) para
-- conseguir mostrar a variação ("+N novas nos últimos 7/30 dias"), igual aos outros
-- mirrors do dashboard (ShopMonkey/Kommo).
--
-- Requer GOOGLE_PLACES_API_KEY no ambiente das functions (Maps Platform, billing on,
-- "Places API (New)" habilitada). Enquanto a key não existir, a tabela fica vazia e o
-- card mostra um estado "configure a key" — nada quebra.

CREATE TABLE IF NOT EXISTS public.google_reviews_snapshot (
  place_id     text NOT NULL,                                   -- Google place_id (ChIJ...)
  place_name   text,                                            -- displayName (ex.: "Pro Car Sound & Security")
  rating       numeric(2,1),                                    -- nota média (ex.: 4.9)
  review_count integer NOT NULL,                                -- userRatingCount (total de avaliações)
  captured_at  timestamptz NOT NULL DEFAULT now(),
  captured_day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  PRIMARY KEY (place_id, captured_day)                          -- 1 snapshot/dia/lugar (re-run no mesmo dia = update)
);
CREATE INDEX IF NOT EXISTS idx_google_reviews_captured ON public.google_reviews_snapshot (captured_at DESC);

-- RLS: dashboard lê com anon/auth (somente SELECT); a edge function escreve com a
-- service role (bypassa RLS).
ALTER TABLE public.google_reviews_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_google_reviews_snapshot" ON public.google_reviews_snapshot;
CREATE POLICY "read_google_reviews_snapshot" ON public.google_reviews_snapshot
  FOR SELECT TO anon, authenticated USING (true);

-- RPC: último snapshot + a contagem de 7 e 30 dias atrás (para o card calcular o
-- "+N novas avaliações"). Sem histórico suficiente, os campos *_ago vêm NULL.
CREATE OR REPLACE FUNCTION public.get_google_reviews()
RETURNS TABLE(
  place_id      text,
  place_name    text,
  rating        numeric,
  review_count  integer,
  captured_at   timestamptz,
  count_7d_ago  integer,
  count_30d_ago integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT * FROM public.google_reviews_snapshot
    ORDER BY captured_at DESC
    LIMIT 1
  )
  SELECT
    l.place_id,
    l.place_name,
    l.rating,
    l.review_count,
    l.captured_at,
    (SELECT s.review_count FROM public.google_reviews_snapshot s
       WHERE s.place_id = l.place_id AND s.captured_day <= l.captured_day - 7
       ORDER BY s.captured_day DESC LIMIT 1) AS count_7d_ago,
    (SELECT s.review_count FROM public.google_reviews_snapshot s
       WHERE s.place_id = l.place_id AND s.captured_day <= l.captured_day - 30
       ORDER BY s.captured_day DESC LIMIT 1) AS count_30d_ago
  FROM latest l;
$$;

GRANT EXECUTE ON FUNCTION public.get_google_reviews() TO anon, authenticated;
