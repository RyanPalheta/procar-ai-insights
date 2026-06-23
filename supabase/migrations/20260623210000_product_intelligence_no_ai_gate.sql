-- 2026-06-23: a "Inteligência de Produtos" mostrava muito menos que o detectado.
-- Ex.: hoje 49 leads, 33 com produto detectado (scan-services, por palavra-chave),
-- mas a RPC retornava só 15 — porque tinha `last_ai_update IS NOT NULL`, prendendo
-- o número à velocidade da análise da IA (analyze-lead roda em lotes e fica para
-- trás). services_detected NÃO depende da IA (é detecção por texto do chat), então
-- esse filtro era indevido: removido (os 18 leads já detectados deixam de ser
-- ocultados). Também adiciona as exclusões padrão is_duplicate/kommo_absent
-- (regra do projeto para leituras de lead_db, que esta RPC não aplicava).
--
-- Observação: upsell_products continua vindo da IA; leads sem análise apenas têm
-- esse array vazio, então o as_upsell não é afetado negativamente.

CREATE OR REPLACE FUNCTION public.get_product_intelligence(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(product text, leads bigint, share_pct numeric, as_upsell bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT session_id, services_detected, upsell_products
    FROM public.lead_db
    WHERE NOT coalesce(is_duplicate, false)
      AND NOT coalesce(kommo_absent, false)
      AND (date_from IS NULL OR created_at >= date_from)
      AND (date_to   IS NULL OR created_at <  date_to)
  ),
  total AS (
    SELECT count(*) AS n FROM base
    WHERE services_detected IS NOT NULL AND array_length(services_detected, 1) > 0
  ),
  detected AS (
    SELECT public.canonical_product(p) AS product, count(DISTINCT session_id) AS leads
    FROM base, unnest(coalesce(services_detected, '{}'::text[])) AS p
    WHERE public.canonical_product(p) IS NOT NULL
    GROUP BY 1
  ),
  ups AS (
    SELECT public.canonical_product(p) AS product, count(DISTINCT session_id) AS as_upsell
    FROM base, unnest(coalesce(upsell_products, '{}'::text[])) AS p
    WHERE public.canonical_product(p) IS NOT NULL
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
