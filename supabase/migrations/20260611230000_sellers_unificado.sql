-- 2026-06-11 (pedido Pro Car): a página Vendedores vira UMA visualização só —
-- o funil da loja (get_sellers_shopmonkey_kpis) é mesclado no painel de
-- qualidade do chat (get_sellers_kpis), por vendedor. Para a chave do merge
-- bater, os dois lados precisam do MESMO nome canônico:
--
-- 1. canonical_seller: "João Pedro - Pro Car" (Kommo) não casava com "JP"
--    (ShopMonkey) — o IN exigia o nome exato. Passa a casar por LIKE.
-- 2. get_sellers_kpis: agrupa por canonical_seller(sales_person_id) (antes era
--    o texto cru, que duplicava JP) e aplica a regra de paridade do painel
--    (exclui is_duplicate e kommo_absent — leituras de lead_db p/ KPI).

CREATE OR REPLACE FUNCTION public.canonical_seller(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN lower(raw) ~ 'registrad|no notes' THEN NULL
    WHEN lower(raw) LIKE '%henrique%' THEN 'Henrique'
    WHEN lower(raw) LIKE '%ricar%'    THEN 'Ricardo'   -- ricardo, ricarod
    WHEN lower(raw) LIKE '%matheus%'  THEN 'Matheus'
    WHEN lower(raw) LIKE '%gabriel%'  THEN 'Gabriel'
    WHEN lower(raw) LIKE '%vitor%' OR lower(raw) LIKE '%vítor%' THEN 'Vitor'
    WHEN lower(raw) LIKE '%joao pedro%' OR lower(raw) LIKE '%joão pedro%' THEN 'JP'
    WHEN lower(btrim(raw)) IN ('jp','joao','joão') THEN 'JP'
    WHEN lower(raw) LIKE '%maestro%'  THEN 'Maestro'
    ELSE initcap(btrim(raw))
  END
$$;

CREATE OR REPLACE FUNCTION public.get_sellers_kpis(
  period_days integer DEFAULT NULL::integer,
  date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  date_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  period_end TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    period_start := date_from;
    period_end := date_to;
  ELSIF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  SELECT json_agg(seller_row) INTO result
  FROM (
    SELECT
      public.canonical_seller(l.sales_person_id) as seller_id,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) as total_audited,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND (LOWER(l.sales_status) LIKE '%ganha%' OR LOWER(l.sales_status) LIKE '%won%' OR LOWER(l.sales_status) LIKE '%agendamento confirmado%')) as won_leads,
      COALESCE(ROUND(AVG(l.lead_score) FILTER (WHERE l.last_ai_update IS NOT NULL)::numeric, 1), 0) as avg_score,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.created_at >= NOW() - INTERVAL '24 hours') as new_audited_24h,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.lead_price IS NOT NULL) as leads_with_quote,
      COALESCE(ROUND(AVG(l.lead_price) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.lead_price IS NOT NULL)::numeric, 2), 0) as avg_quoted_price,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.is_walking = true) as walking_leads,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.has_objection = true) as total_with_objection,
      COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL AND l.has_objection = true AND l.objection_overcome = true) as objections_overcome
    FROM lead_db l
    WHERE l.sales_person_id IS NOT NULL
      AND l.sales_person_id != ''
      AND public.canonical_seller(l.sales_person_id) IS NOT NULL
      AND l.source_system IS DISTINCT FROM 'kommo_sync'
      AND l.is_duplicate IS NOT TRUE
      AND l.kommo_absent IS NOT TRUE
      AND (
        (date_from IS NOT NULL AND l.created_at >= period_start AND l.created_at <= period_end)
        OR (date_from IS NULL AND (period_days IS NULL OR l.created_at >= period_start))
      )
    GROUP BY public.canonical_seller(l.sales_person_id)
    HAVING COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) DESC
  ) seller_row;

  IF result IS NULL THEN
    result := '[]'::json;
  END IF;

  RETURN result;
END;
$function$;
