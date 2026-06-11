-- 2026-06-11 (2ª auditoria, exigência Pro Car: "o dashboard deve ser igual à Kommo").
-- Mesmo com janelas alinhadas, o painel contava 10-20% ACIMA da Kommo (ex.: 10/06 ET:
-- Kommo 56 × painel 67). Causa: o lead_db é insert-only — leads APAGADOS/MESCLADOS na
-- Kommo (dedup nativo dela) continuam aqui, e linhas de chat sem espelho idem.
--
-- Solução não-destrutiva:
--   1. lead_db.kommo_absent (flag): marcado pelo reconcile-kommo {mark_missing:true},
--      que compara os IDs do painel com os IDs reais da Kommo na janela (com folga de
--      ±1 dia nas bordas p/ não falso-positivar por skew de created_at).
--   2. VIEW lead_db_painel = lead_db sem duplicatas (fase 2) e sem ausentes da Kommo.
--   3. get_leads_kpis passa a contar sobre a VIEW -> painel = Kommo por construção.

ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS kommo_absent boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_lead_db_kommo_absent ON public.lead_db (kommo_absent) WHERE kommo_absent;

CREATE OR REPLACE VIEW public.lead_db_painel WITH (security_invoker = true) AS
  SELECT * FROM public.lead_db
  WHERE is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE;

GRANT SELECT ON public.lead_db_painel TO anon, authenticated;

-- Recria get_leads_kpis contando sobre a view (única mudança: lead_db -> lead_db_painel).
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
    'sale_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%'))
    END,
    'sale_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'appointment_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%'))
    END,
    'appointment_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE (LOWER(sales_status) LIKE '%agendamento confirmado%' OR LOWER(sales_status) LIKE '%faltou agendamento%' OR LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'no_show_leads', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE LOWER(sales_status) LIKE '%faltou agendamento%' AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE LOWER(sales_status) LIKE '%faltou agendamento%')
    END,
    'no_show_leads_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE LOWER(sales_status) LIKE '%faltou agendamento%' AND created_at >= previous_period_start AND created_at < previous_period_end)
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
    'leads_with_quote', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE lead_price IS NOT NULL)
    END,
    'leads_with_quote_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel WHERE lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_quoted_price', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db_painel WHERE lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db_painel WHERE lead_price IS NOT NULL)
    END,
    'avg_quoted_price_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db_painel WHERE lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
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

-- Cron do reconcile passa a TAMBÉM marcar os ausentes (janela móvel 30d).
DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('reconcile-kommo-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('reconcile-kommo-daily', '50 6 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/reconcile-kommo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('window_days', 30, 'mark_missing', true)
  );
$job$);
