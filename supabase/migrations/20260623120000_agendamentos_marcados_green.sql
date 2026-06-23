-- 2026-06-23 (pedido Pro Car): card "Agendamentos Marcados" = agendamentos do
-- periodo contando SO os green (confirmados), pela data de MARCACAO (created_date).
-- Distinto de appointment_leads, que conta green pela data AGENDADA (start_date).
-- Mede a producao de agendamentos confirmados do periodo. Demais chaves inalteradas
-- vs a versao viva do get_leads_kpis (sale_leads = shopmonkey_sale, no_show = red,
-- cotacao = shopmonkey_order, 1a resposta em horario comercial).

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
  shop_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York';
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
    -- VENDAS = orcamentos PAGOS no ShopMonkey, por data do pagamento (fully_paid_date).
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
    -- AGENDAMENTOS = ShopMonkey green, por data do agendamento (start_date).
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
    -- AGENDAMENTOS MARCADOS (NOVO) = green pela data de MARCACAO (created_date).
    -- Producao de agendamentos confirmados do periodo (so vale se green).
    'appointments_booked', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green' AND created_date >= period_start AND (period_end IS NULL OR created_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green')
    END,
    'appointments_booked_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE color = 'green' AND created_date >= previous_period_start AND created_date < previous_period_end)
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
    -- LEADS NOVOS HOJE: meia-noite -> 23:59 do dia corrente no fuso da loja;
    -- "previous" = ONTEM (dia completo). Chaves mantidas por compatibilidade.
    'new_audited_24h', (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= shop_today_start),
    'new_audited_24h_previous', (SELECT COUNT(*) FROM lead_db_painel WHERE created_at >= shop_today_start - interval '1 day' AND created_at < shop_today_start),
    -- COTACOES = orders do ShopMonkey criados no periodo (nao arquivados), a mesma
    -- fonte dos "orcamentos" da aba Vendedores. O chat (lead_price) capta poucas.
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
    -- 1a RESPOSTA: minutos contados SO dentro do horario de atendimento
    -- (09h-20h America/New_York) entre a 1a msg do cliente e a 1a resposta.
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
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY public.business_minutes_between(fc.first_client, fa.first_agent))::numeric, 1), 0)
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
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY public.business_minutes_between(fc.first_client, fa.first_agent))::numeric, 1), 0)
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
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY public.business_minutes_between(fc.first_client, fa.first_agent))::numeric, 1), 0)
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
