-- 2026-06-06: Visao Geral — finaliza itens "em ajuste" decidindo:
--   (1) CONVERSAO em DUAS metricas separadas: conversao de VENDA e de AGENDAMENTO
--       (decisao Pro Car), em vez de somar as duas num so numero.
--   (2) KPIs de fonte KOMMO (conversao, cotacao) contam sobre a BASE COMPLETA ja
--       convergida (backfill 120d), nao mais so sobre os ~36,5% auditados pela IA.
--       sales_status e lead_price existem para a base Kommo inteira.
--
-- Mudancas:
--   get_leads_kpis: + total_leads, sale_leads, appointment_leads (todos full base,
--     por created_at) e desacopla leads_with_quote / avg_quoted_price do last_ai_update.
--     total_audited / won_leads sao MANTIDOS (usados nos KPIs puramente de IA e p/ compat).
--   Venda            = LOWER(sales_status) LIKE '%ganha%' OR '%won%'  (Venda ganha / carteira)
--   Agendamento      = LOWER(sales_status) LIKE '%agendamento confirmado%'  (exclui "Faltou agendamento")
--   get_conversion_by_response_time / get_conversion_by_quote_bracket: "conversao"
--     passa a ser SO VENDA (dropa agendamento), p/ casar com a definicao acima.

CREATE OR REPLACE FUNCTION public.get_leads_kpis(period_days integer DEFAULT NULL::integer, date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  period_end TIMESTAMP;
  previous_period_start TIMESTAMP;
  previous_period_end TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    period_start := date_from;
    period_end := date_to;
    previous_period_start := date_from - (date_to - date_from);
    previous_period_end := date_from;
  ELSIF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
    period_end := NULL;
    previous_period_end := period_start;
    previous_period_start := NOW() - (period_days * 2 || ' days')::INTERVAL;
  END IF;

  SELECT json_build_object(
    'total_audited', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL)
    END,
    'total_audited_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- BASE COMPLETA (Kommo convergido): total de leads do periodo, sem filtro de IA.
    'total_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db)
    END,
    'total_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- CONVERSAO DE VENDA (full base): sales_status "Venda ganha" / "Venda GANHA (carteira)".
    'sale_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%'))
    END,
    'sale_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- CONVERSAO DE AGENDAMENTO (full base): so "Agendamento confirmado" (exclui "Faltou agendamento").
    'appointment_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%agendamento confirmado%' AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%agendamento confirmado%')
    END,
    'appointment_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%agendamento confirmado%' AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- won_leads = venda + agendamento (MANTIDO p/ compatibilidade; nao mais exibido como "a conversao").
    'won_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%'))
    END,
    'won_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_score', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL)
    END,
    'avg_score_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'new_audited_24h', (SELECT COUNT(*) FROM lead_db WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'new_audited_24h_previous', (SELECT COUNT(*) FROM lead_db WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours'),
    -- COTACAO (full base): conta qualquer lead com preco (chat IA + price do Kommo), sem filtro de IA.
    'leads_with_quote', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE lead_price IS NOT NULL)
    END,
    'leads_with_quote_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_quoted_price', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE lead_price IS NOT NULL)
    END,
    'avg_quoted_price_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'median_first_response_time_minutes', CASE
      WHEN period_start IS NOT NULL THEN
        (WITH base AS (
          SELECT i.session_id AS session_id, i.timestamp AS ts, i.sender_type AS sender_type
          FROM interaction_db i INNER JOIN lead_db l ON i.session_id = l.session_id
          WHERE i.session_id IS NOT NULL AND l.created_at >= period_start AND (period_end IS NULL OR l.created_at <= period_end)
        ), fc AS (
          SELECT session_id, MIN(ts) AS first_client FROM base WHERE sender_type IS DISTINCT FROM 'agent' GROUP BY session_id
        ), fa AS (
          SELECT b.session_id, MIN(b.ts) AS first_agent FROM base b JOIN fc ON b.session_id = fc.session_id
          WHERE b.sender_type = 'agent' AND b.ts > fc.first_client GROUP BY b.session_id
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fa.first_agent - fc.first_client)) / 60)::numeric, 1), 0)
        FROM fc JOIN fa ON fc.session_id = fa.session_id)
      ELSE
        (WITH base AS (
          SELECT session_id AS session_id, timestamp AS ts, sender_type AS sender_type
          FROM interaction_db WHERE session_id IS NOT NULL
        ), fc AS (
          SELECT session_id, MIN(ts) AS first_client FROM base WHERE sender_type IS DISTINCT FROM 'agent' GROUP BY session_id
        ), fa AS (
          SELECT b.session_id, MIN(b.ts) AS first_agent FROM base b JOIN fc ON b.session_id = fc.session_id
          WHERE b.sender_type = 'agent' AND b.ts > fc.first_client GROUP BY b.session_id
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fa.first_agent - fc.first_client)) / 60)::numeric, 1), 0)
        FROM fc JOIN fa ON fc.session_id = fa.session_id)
    END,
    'median_first_response_time_minutes_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (WITH base AS (
          SELECT i.session_id AS session_id, i.timestamp AS ts, i.sender_type AS sender_type
          FROM interaction_db i INNER JOIN lead_db l ON i.session_id = l.session_id
          WHERE i.session_id IS NOT NULL AND l.created_at >= previous_period_start AND l.created_at < previous_period_end
        ), fc AS (
          SELECT session_id, MIN(ts) AS first_client FROM base WHERE sender_type IS DISTINCT FROM 'agent' GROUP BY session_id
        ), fa AS (
          SELECT b.session_id, MIN(b.ts) AS first_agent FROM base b JOIN fc ON b.session_id = fc.session_id
          WHERE b.sender_type = 'agent' AND b.ts > fc.first_client GROUP BY b.session_id
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fa.first_agent - fc.first_client)) / 60)::numeric, 1), 0)
        FROM fc JOIN fa ON fc.session_id = fa.session_id)
      ELSE NULL
    END,
    'walking_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE walk_in = true AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE walk_in = true)
    END,
    'walking_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE walk_in = true AND start_date >= previous_period_start AND start_date < previous_period_end)
      ELSE NULL
    END,
    'upsell_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'upsell_total_value', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_total_value_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END
  ) INTO result;

  RETURN result;
END;
$function$;

-- =========================================================================
-- get_conversion_by_response_time: "conversao" = SO VENDA (ganha/won).
-- Mantem o filtro de IA + amostra de chat (>=3 msgs) — este grafico segue
-- limitado pela cobertura de chat; aqui so alinhamos a DEFINICAO de conversao.
-- =========================================================================
CREATE OR REPLACE FUNCTION get_conversion_by_response_time(period_days integer DEFAULT NULL, date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL)
RETURNS TABLE(
  time_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  period_start TIMESTAMP;
  period_end TIMESTAMP;
  use_range BOOLEAN := FALSE;
BEGIN
  IF date_from IS NOT NULL THEN
    use_range := TRUE;
    period_start := date_from;
    period_end := date_to;
  ELSIF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH ranked_interactions AS (
    SELECT
      i.session_id,
      i.timestamp,
      ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.timestamp) as interaction_num
    FROM interaction_db i
    INNER JOIN lead_db l ON i.session_id = l.session_id
    WHERE i.session_id IS NOT NULL
    AND l.last_ai_update IS NOT NULL
    AND (
      (use_range
        AND l.created_at >= period_start AND l.created_at <= period_end)
      OR
      (NOT use_range
        AND (period_days IS NULL OR l.created_at >= period_start))
    )
  ),
  response_times AS (
    SELECT
      r.session_id,
      MAX(CASE WHEN r.interaction_num = 1 THEN r.timestamp END) as t1,
      MAX(CASE WHEN r.interaction_num = 3 THEN r.timestamp END) as t3
    FROM ranked_interactions r
    WHERE r.interaction_num <= 3
    GROUP BY r.session_id
    HAVING COUNT(*) >= 3
  ),
  times_with_status AS (
    SELECT
      rt.session_id,
      EXTRACT(EPOCH FROM (rt.t3 - rt.t1)) / 60 as response_minutes,
      l.sales_status
    FROM response_times rt
    INNER JOIN lead_db l ON rt.session_id = l.session_id
  ),
  bracketed AS (
    SELECT
      CASE
        WHEN response_minutes <= 15 THEN '0-15 min'
        WHEN response_minutes <= 30 THEN '15-30 min'
        WHEN response_minutes <= 60 THEN '30-60 min'
        ELSE '60+ min'
      END as bracket,
      sales_status
    FROM times_with_status
  )
  SELECT
    b.bracket as time_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%')::bigint as converted_leads,
    ROUND(
      COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%') * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate
  FROM bracketed b
  GROUP BY b.bracket
  ORDER BY
    CASE b.bracket
      WHEN '0-15 min' THEN 1
      WHEN '15-30 min' THEN 2
      WHEN '30-60 min' THEN 3
      ELSE 4
    END;
END;
$$;

-- =========================================================================
-- get_conversion_by_quote_bracket: "conversao" = SO VENDA (ganha/won).
-- =========================================================================
CREATE OR REPLACE FUNCTION get_conversion_by_quote_bracket(
  period_days integer DEFAULT NULL,
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  quote_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric,
  avg_quote_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  period_start TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    NULL;
  ELSE
    IF period_days IS NOT NULL THEN
      period_start := NOW() - (period_days || ' days')::INTERVAL;
    END IF;
  END IF;

  RETURN QUERY
  WITH bracketed AS (
    SELECT
      CASE
        WHEN lead_price IS NULL OR lead_price = 0 THEN 'Sem Cotação'
        WHEN lead_price <= 500 THEN '$0-500'
        WHEN lead_price <= 1000 THEN '$500-1000'
        WHEN lead_price <= 2000 THEN '$1000-2000'
        ELSE '$2000+'
      END as bracket,
      lead_price,
      sales_status
    FROM lead_db
    WHERE last_ai_update IS NOT NULL
    AND (
      CASE
        WHEN date_from IS NOT NULL THEN created_at >= date_from AND created_at <= date_to
        ELSE (period_days IS NULL OR created_at >= period_start)
      END
    )
  )
  SELECT
    b.bracket as quote_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (
      WHERE LOWER(b.sales_status) LIKE '%ganha%'
         OR LOWER(b.sales_status) LIKE '%won%'
    )::bigint as converted_leads,
    ROUND(
      COUNT(*) FILTER (
        WHERE LOWER(b.sales_status) LIKE '%ganha%'
           OR LOWER(b.sales_status) LIKE '%won%'
      ) * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate,
    ROUND(AVG(b.lead_price)::numeric, 2) as avg_quote_value
  FROM bracketed b
  GROUP BY b.bracket
  ORDER BY
    CASE b.bracket
      WHEN 'Sem Cotação' THEN 1
      WHEN '$0-500' THEN 2
      WHEN '$500-1000' THEN 3
      WHEN '$1000-2000' THEN 4
      ELSE 5
    END;
END;
$$;
