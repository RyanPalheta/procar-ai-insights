-- 2026-06-24: KPIs de ORIGEM do agendamento (checklist secao K, itens 37/38).
-- Cards AMARELOS (regra de captura deterministica a partir do note do ShopMonkey):
--   referral_appointments       -> shopmonkey_appointment.is_referral (BLOCO K #37 "Indicacao de amigo")
--   cliente_antigo_appointments -> shopmonkey_appointment.source = 'cliente antigo' (#38 "Cliente antigo")
-- Contagem PARCIAL (source/is_referral so quando a equipe escreve no note) -> disclaimer amarelo no card.
-- RPC SEPARADA de proposito: nao mexe em get_leads_kpis (funcao critica). Mesmo contrato
-- date_from/date_to + janela anterior (previous) das demais RPCs. Filtra por start_date
-- (data do agendamento), igual ao card de walk-in.

CREATE OR REPLACE FUNCTION public.get_appointment_origin_kpis(
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
    'referral_appointments', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment
          WHERE is_referral AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE is_referral)
    END,
    'referral_appointments_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment
          WHERE is_referral AND start_date >= prev_start AND start_date < prev_end)
      ELSE NULL
    END,
    'cliente_antigo_appointments', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment
          WHERE source = 'cliente antigo' AND start_date >= period_start AND (period_end IS NULL OR start_date <= period_end))
      ELSE
        (SELECT COUNT(*) FROM shopmonkey_appointment WHERE source = 'cliente antigo')
    END,
    'cliente_antigo_appointments_previous', CASE
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM shopmonkey_appointment
          WHERE source = 'cliente antigo' AND start_date >= prev_start AND start_date < prev_end)
      ELSE NULL
    END
  ) INTO result;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_appointment_origin_kpis(timestamptz, timestamptz) TO anon, authenticated;
