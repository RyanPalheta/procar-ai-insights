-- 2026-06-06: Inteligência de Produtos (pedido transversal "destrinchar por
-- produto" + "Top 5 Produtos → inteligência de produtos: ranking + share +
-- segmentação"). Dado real disponível: lead_db.services_detected (text[], ~70%)
-- = serviços detectados pela IA na conversa; upsell_products (text[]) = produtos
-- oferecidos como upsell. Ranking global por demanda + share % + frequência como
-- upsell. É o subconjunto de chat auditado (honesto; rotulado na UI).

CREATE OR REPLACE FUNCTION public.get_product_intelligence(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(product text, leads bigint, share_pct numeric, as_upsell bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT session_id, services_detected, upsell_products
    FROM public.lead_db
    WHERE last_ai_update IS NOT NULL
      AND (date_from IS NULL OR created_at >= date_from)
      AND (date_to   IS NULL OR created_at <  date_to)
  ),
  total AS (
    SELECT count(*) AS n FROM base
    WHERE services_detected IS NOT NULL AND array_length(services_detected, 1) > 0
  ),
  detected AS (
    SELECT upper(btrim(p)) AS product, count(DISTINCT session_id) AS leads
    FROM base, unnest(coalesce(services_detected, '{}'::text[])) AS p
    WHERE btrim(p) <> ''
    GROUP BY 1
  ),
  ups AS (
    SELECT upper(btrim(p)) AS product, count(DISTINCT session_id) AS as_upsell
    FROM base, unnest(coalesce(upsell_products, '{}'::text[])) AS p
    WHERE btrim(p) <> ''
    GROUP BY 1
  )
  SELECT coalesce(d.product, u.product) AS product,
         coalesce(d.leads, 0) AS leads,
         round(100.0 * coalesce(d.leads, 0) / nullif((SELECT n FROM total), 0), 1) AS share_pct,
         coalesce(u.as_upsell, 0) AS as_upsell
  FROM detected d
  FULL OUTER JOIN ups u ON d.product = u.product
  ORDER BY coalesce(d.leads, 0) DESC, coalesce(u.as_upsell, 0) DESC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_intelligence(timestamptz, timestamptz) TO anon, authenticated;
