-- 2026-06-06: get_sellers_kpis passa a retornar total_leads (total de leads de chat
-- do vendedor) além de total_audited (os auditados pela IA). Assim o painel mostra
-- "X de Y auditados" e some a aparente contradição com o painel ShopMonkey (ex.:
-- Ricardo 134 agendamentos vs 97 auditados — agora 97 de 318 leads de chat).
-- Base = só chat (exclui os espelhos source_system='kommo_sync'); métricas de
-- qualidade (won/cotação/objeção/score) seguem só sobre os auditados via FILTER.

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
    WHERE l.sales_person_id IS NOT NULL
      AND l.sales_person_id != ''
      AND l.source_system IS DISTINCT FROM 'kommo_sync'
      AND (
        (date_from IS NOT NULL AND l.created_at >= period_start AND l.created_at <= period_end)
        OR (date_from IS NULL AND (period_days IS NULL OR l.created_at >= period_start))
      )
    GROUP BY l.sales_person_id
    HAVING COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE l.last_ai_update IS NOT NULL) DESC
  ) seller_row;

  IF result IS NULL THEN
    result := '[]'::json;
  END IF;

  RETURN result;
END;
$function$;
