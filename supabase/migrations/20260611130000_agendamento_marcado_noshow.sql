-- 2026-06-11 (2ª auditoria, legenda E — aprovada pela Pro Car em 11/06):
-- "não faz sentido conversão de agendamento (5,8%) menor que a de venda (10,4%);
--  quem virou venda passou por agendamento; e o 'faltou agendamento' marcou o
--  agendamento (foi convertido) — o no-show/cancelamento deve vir separado."
--
-- O sales_status é um SNAPSHOT: quando o lead avança para "Venda ganha" ele SAI
-- de "Agendamento confirmado", e "Faltou agendamento" era excluído — por isso a
-- inversão. Nova definição:
--   appointment_leads (AGENDAMENTO MARCADO) = "Agendamento confirmado"
--     + "Faltou agendamento" (marcou e não veio) + vendas (ganha/won — passaram
--     pelo agendamento). Garante agendamento >= venda, como o funil real.
--   no_show_leads (NOVO) = "Faltou agendamento", exposto separadamente.
-- Demais chaves do get_leads_kpis inalteradas.

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
    -- AGENDAMENTO MARCADO (full base): confirmado + faltou (no-show) + vendas.
    -- (2ª auditoria, legenda E: venda passa por agendamento; no-show marcou agendamento.)
    'appointment_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%'))
    END,
    'appointment_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- NO-SHOW (NOVO): "Faltou agendamento" separado, como pedido na auditoria.
    'no_show_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%faltou agendamento%' AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%faltou agendamento%')
    END,
    'no_show_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE LOWER(sales_status) LIKE '%faltou agendamento%' AND created_at >= previous_period_start AND created_at < previous_period_end)
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
