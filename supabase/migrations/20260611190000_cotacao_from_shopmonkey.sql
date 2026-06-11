-- 2026-06-11 (pedido Pro Car, print 10:18): cotação e venda devem puxar do
-- ShopMonkey. O chat (lead_db.lead_price) capta pouquíssimas cotações — o card
-- mostrava 0 no dia em que a loja fez orçamentos. A cotação real é um ORDER do
-- ShopMonkey (todo order nasce orçamento; vira venda quando pago) — mesma fonte
-- que a aba Vendedores já usa (orcamentos/vendas em get_sellers_shopmonkey_kpis):
--   leads_with_quote = orders criados no período, não arquivados (created_date);
--   avg_quoted_price = média do total do order (total_cost_cents/100, USD),
--                      só orders com valor > 0 (orçamento vazio não é cotação);
--   sale_leads       = orçamentos PAGOS (shopmonkey_sale, por fully_paid_date) —
--                      a Conversão de Venda vira pagos ÷ leads, par da Conversão
--                      de Agendamento (green ÷ leads).
-- Só os blocos sale_leads/leads_with_quote/avg_quoted_price mudam vs 20260611180000.

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
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL)
    END,
    'total_audited_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'total_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel)
    END,
    'total_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    -- VENDAS = orçamentos PAGOS no ShopMonkey, por data do pagamento (fully_paid_date).
    'sale_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_sale WHERE fully_paid_date >= period_start AND (period_end IS NULL OR fully_paid_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_sale)
    END,
    'sale_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_sale WHERE fully_paid_date >= previous_period_start AND fully_paid_date < previous_period_end)
      ELSE NULL
    END,
    -- AGENDAMENTOS = ShopMonkey green, por data do agendamento (fórmula Pro Car).
    'appointment_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green' AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green')
    END,
    'appointment_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green' AND start_date >= previous_period_start AND start_date < previous_period_end)
      ELSE NULL
    END,
    -- NO-SHOW = ShopMonkey VERMELHO (faltou/cancelou), por data do agendamento.
    'no_show_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'red' AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'red')
    END,
    'no_show_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'red' AND start_date >= previous_period_start AND start_date < previous_period_end)
      ELSE NULL
    END,
    'won_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%'))
    END,
    'won_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_score', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL)
    END,
    'avg_score_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db_painel WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'new_audited_24h', (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'new_audited_24h_previous', (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours'),
    -- COTAÇÕES = orders do ShopMonkey criados no período (não arquivados), a mesma
    -- fonte dos "orçamentos" da aba Vendedores. O chat (lead_price) capta poucas.
    'leads_with_quote', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_order WHERE COALESCE(archived, false) = false AND created_date >= period_start AND (period_end IS NULL OR created_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_order WHERE COALESCE(archived, false) = false)
    END,
    'leads_with_quote_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_order WHERE COALESCE(archived, false) = false AND created_date >= previous_period_start AND created_date < previous_period_end)
      ELSE NULL
    END,
    'avg_quoted_price', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(total_cost_cents / 100.0)::numeric, 2), 0) FROM shopmonkey_order WHERE COALESCE(archived, false) = false AND total_cost_cents > 0 AND created_date >= period_start AND (period_end IS NULL OR created_date <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(total_cost_cents / 100.0)::numeric, 2), 0) FROM shopmonkey_order WHERE COALESCE(archived, false) = false AND total_cost_cents > 0)
    END,
    'avg_quoted_price_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(total_cost_cents / 100.0)::numeric, 2), 0) FROM shopmonkey_order WHERE COALESCE(archived, false) = false AND total_cost_cents > 0 AND created_date >= previous_period_start AND created_date < previous_period_end)
      ELSE NULL
    END,
    'median_first_response_time_minutes', CASE
      WHEN period_start IS NOT NULL THEN
        (WITH base AS (
          SELECT i.session_id AS session_id, i.timestamp AS ts, i.sender_type AS sender_type
          FROM interaction_db i INNER JOIN lead_db_painel l ON i.session_id = l.session_id
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
          FROM interaction_db i INNER JOIN lead_db_painel l ON i.session_id = l.session_id
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
        (SELECT COUNT(*) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'upsell_total_value', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_total_value_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db_painel WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END
  ) INTO result;

  RETURN result;
END;
$function$;
