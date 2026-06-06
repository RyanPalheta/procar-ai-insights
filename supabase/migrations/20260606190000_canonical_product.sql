-- 2026-06-06: canonicalização de produto (nomes vêm crus da IA e fragmentam).
-- Regras SEGURAS, sem fundir produtos distintos:
--   - tira sufixo "INSTALLATION/INSTALL" (CARPLAY INSTALLATION = CARPLAY)
--   - corrige typo da marca do filme: SUNKET/SUNKTEK -> SUNTEK (mantém as linhas
--     CERAMIC/CARBON/STANDARD/HIGH PERFORMANCE SEPARADAS — são produtos diferentes)
--   - STANDART -> STANDARD; WINDOW TINTING -> WINDOW TINT; remove sufixo " (EACH)"
--   - NÃO funde marcas de áudio (ALPINE/PIONEER/KENWOOD/JENSEN/KICKER ficam distintas)

CREATE OR REPLACE FUNCTION public.canonical_product(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(
    regexp_replace(
      replace(
        replace(replace(replace(replace(
          upper(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')),
          'SUNKTEK', 'SUNTEK'),
          'SUNKET', 'SUNTEK'),
          'STANDART', 'STANDARD'),
          'WINDOW TINTING', 'WINDOW TINT'),
        ' (EACH)', ''),
      '\s+(INSTALLATIONS?|INSTALL)\s*$', '', 'g')
  ), '')
$$;

GRANT EXECUTE ON FUNCTION public.canonical_product(text) TO anon, authenticated;

-- Recria o ranking usando canonical_product (variações somam no mesmo produto).
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
