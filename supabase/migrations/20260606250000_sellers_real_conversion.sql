-- 2026-06-06: taxas de conversão REAIS por vendedor.
-- Problema: o "total" por vendedor vinha do ShopMonkey (só quem virou cliente na
-- loja) ou do chat (subconta) -> dava "mais propostas que clientes" e conversão ~95%.
-- Correção: o TOTAL DE LEADS por vendedor é o do lead_db COMPLETO (= total da Kommo,
-- pós-keystone: chat + espelhos kommo_sync, atribuídos pelo CF "Vendedor shopmonkey").
-- Ricardo passa de 141 -> 315 leads; conversão venda/leads ~43% (realista).

-- 1) get_sellers_shopmonkey_kpis: + leads (total Kommo) + conversão + taxa de agendamento.
DROP FUNCTION IF EXISTS public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz);
CREATE FUNCTION public.get_sellers_shopmonkey_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller          text,
  leads           bigint,
  agendamentos    bigint,
  walk_ins        bigint,
  orcamentos      bigint,
  vendas          bigint,
  receita_usd     numeric,
  conv_pct        numeric,
  taxa_agend_pct  numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lds AS (   -- total de leads por vendedor = lead_db completo (= total da Kommo)
    SELECT sales_person_id AS seller, count(*) AS leads
    FROM public.lead_db
    WHERE sales_person_id IS NOT NULL AND sales_person_id <> ''
      AND (date_from IS NULL OR created_at >= date_from)
      AND (date_to   IS NULL OR created_at <  date_to)
    GROUP BY sales_person_id
  ),
  ag AS (
    SELECT public.canonical_seller(seller) AS seller,
           count(*) FILTER (WHERE color = 'green') AS agendamentos,
           count(*) FILTER (WHERE walk_in)         AS walk_ins
    FROM public.shopmonkey_appointment
    WHERE (date_from IS NULL OR start_date >= date_from)
      AND (date_to   IS NULL OR start_date <  date_to)
      AND public.canonical_seller(seller) IS NOT NULL
    GROUP BY 1
  ),
  orc AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = o.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1)) AS seller
    FROM public.shopmonkey_order o
    WHERE (date_from IS NULL OR o.created_date >= date_from)
      AND (date_to   IS NULL OR o.created_date <  date_to)
      AND coalesce(o.archived, false) = false
  ),
  ol AS (SELECT seller, count(*) AS orcamentos FROM orc WHERE seller IS NOT NULL GROUP BY 1),
  sale AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = v.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1)) AS seller,
           v.paid_cost_cents
    FROM public.shopmonkey_sale v
    WHERE (date_from IS NULL OR v.fully_paid_date >= date_from)
      AND (date_to   IS NULL OR v.fully_paid_date <  date_to)
  ),
  sl AS (
    SELECT seller, count(*) AS vendas, round(sum(paid_cost_cents) / 100.0) AS receita_usd
    FROM sale WHERE seller IS NOT NULL GROUP BY 1
  ),
  sellers AS (
    SELECT seller FROM ag UNION SELECT seller FROM ol UNION SELECT seller FROM sl
  )
  SELECT s.seller,
         coalesce(lds.leads, 0)        AS leads,
         coalesce(ag.agendamentos, 0)  AS agendamentos,
         coalesce(ag.walk_ins, 0)      AS walk_ins,
         coalesce(ol.orcamentos, 0)    AS orcamentos,
         coalesce(sl.vendas, 0)        AS vendas,
         coalesce(sl.receita_usd, 0)   AS receita_usd,
         round(100.0 * coalesce(sl.vendas, 0)       / nullif(lds.leads, 0), 1) AS conv_pct,
         round(100.0 * coalesce(ag.agendamentos, 0) / nullif(lds.leads, 0), 1) AS taxa_agend_pct
  FROM sellers s
  LEFT JOIN lds ON lds.seller = s.seller
  LEFT JOIN ag  ON ag.seller  = s.seller
  LEFT JOIN ol  ON ol.seller  = s.seller
  LEFT JOIN sl  ON sl.seller  = s.seller
  WHERE s.seller IS NOT NULL
  ORDER BY coalesce(lds.leads, 0) DESC, coalesce(sl.receita_usd, 0) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz) TO anon, authenticated;

-- 2) get_sellers_kpis: total_leads = lead_db COMPLETO (inclui espelhos kommo_sync) =
--    total da Kommo. Antes excluía kommo_sync (dava 122); agora completo (315).
CREATE OR REPLACE FUNCTION public.get_sellers_kpis(
  period_days integer DEFAULT NULL,
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result JSON; period_start TIMESTAMP; period_end TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN period_start := date_from; period_end := date_to;
  ELSIF period_days IS NOT NULL THEN period_start := NOW() - (period_days || ' days')::INTERVAL; END IF;

  SELECT json_agg(seller_row) INTO result FROM (
    SELECT
      l.sales_person_id as seller_id,
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
    WHERE l.sales_person_id IS NOT NULL AND l.sales_person_id != ''
      AND ((date_from IS NOT NULL AND l.created_at >= period_start AND l.created_at <= period_end)
           OR (date_from IS NULL AND (period_days IS NULL OR l.created_at >= period_start)))
    GROUP BY l.sales_person_id
    HAVING COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) DESC
  ) seller_row;
  IF result IS NULL THEN result := '[]'::json; END IF;
  RETURN result;
END;
$function$;
