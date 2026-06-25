-- 2026-06-24: KPIs de PIPELINE / PERDAS (checklist secao N, itens 49/50/52).
-- Cards AMARELOS — o motivo da perda vem da analise de IA sobre as conversas de
-- WhatsApp/chat (subconjunto da base), NAO de um campo loss_reason do Kommo (nao existe).
--   lost_total   -> lead_db_painel.sales_status ILIKE '%perdida%'                 (#49 Leads perdidos)
--   lost_distancia -> perdidos com objection_categories @> {distancia}            (#50 Local distante)
--   financeiras  -> leads com objection_categories @> {financiamento}            (#52 Financeiras)
-- Base = lead_db_painel (ja exclui is_duplicate e kommo_absent). Filtro por created_at,
-- mesmo contrato date_from/date_to + janela anterior das demais RPCs.

CREATE OR REPLACE FUNCTION public.get_pipeline_loss_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  period_start timestamptz;
  period_end   timestamptz;
  prev_start   timestamptz;
  prev_end     timestamptz;
BEGIN
  IF date_from IS NOT NULL THEN
    period_start := date_from;
    period_end   := date_to;
    prev_start   := date_from - (date_to - date_from);
    prev_end     := date_from;
  END IF;

  SELECT json_build_object(
    'lost_total', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel
          WHERE sales_status ILIKE '%perdida%' AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE sales_status ILIKE '%perdida%')
    END,
    'lost_total_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel
          WHERE sales_status ILIKE '%perdida%' AND created_at >= prev_start AND created_at < prev_end)
      ELSE NULL
    END,
    -- Local distante = perdido por DISTANCIA: objeção da IA (objection_categories) OU
    -- motivo de perda escrito no Kommo (loss_reason ~ "distante"). Consulta lead_db
    -- direto (a view lead_db_painel nao expoe loss_reason) com as exclusoes do painel.
    'lost_distancia', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db
          WHERE is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE
            AND sales_status ILIKE '%perdida%'
            AND (objection_categories @> ARRAY['distancia'] OR loss_reason ~* 'distan|local distante')
            AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db
          WHERE is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE
            AND sales_status ILIKE '%perdida%'
            AND (objection_categories @> ARRAY['distancia'] OR loss_reason ~* 'distan|local distante'))
    END,
    'lost_distancia_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db
          WHERE is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE
            AND sales_status ILIKE '%perdida%'
            AND (objection_categories @> ARRAY['distancia'] OR loss_reason ~* 'distan|local distante')
            AND created_at >= prev_start AND created_at < prev_end)
      ELSE NULL
    END,
    'financeiras', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel
          WHERE objection_categories @> ARRAY['financiamento']
            AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db_painel WHERE objection_categories @> ARRAY['financiamento'])
    END,
    'financeiras_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db_painel
          WHERE objection_categories @> ARRAY['financiamento']
            AND created_at >= prev_start AND created_at < prev_end)
      ELSE NULL
    END,
    -- Financiamento citado no note do ShopMonkey: SNAP/ACIMA/AMERICAN FIRST, 1 por
    -- ocorrencia (cardinality do array). Por data do agendamento (start_date). (BLOCO N)
    'fin_shopmonkey', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(cardinality(financing)), 0) FROM shopmonkey_appointment
          WHERE cardinality(financing) > 0 AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COALESCE(SUM(cardinality(financing)), 0) FROM shopmonkey_appointment WHERE cardinality(financing) > 0)
    END,
    'fin_shopmonkey_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(cardinality(financing)), 0) FROM shopmonkey_appointment
          WHERE cardinality(financing) > 0 AND start_date >= prev_start AND start_date < prev_end)
      ELSE NULL
    END
  ) INTO result;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_loss_kpis(timestamptz, timestamptz) TO anon, authenticated;
