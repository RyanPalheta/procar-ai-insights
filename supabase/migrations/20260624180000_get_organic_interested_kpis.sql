-- 2026-06-24: ORGANICO "I'm interested" (checklist secao D, itens 16-18). Card AMARELO.
-- Regra: a PRIMEIRA mensagem do cliente (interaction_db, sender_type='client') deve
-- conter "I'm interested" — esse e o TEMPLATE pre-preenchido dos anuncios Meta
-- (FB/IG click-to-message e click-to-WhatsApp): "I'm interested in <produto>".
-- Marca o trafego de anuncio (fora do WhatsApp organico). ~1953 sessoes na base.
-- Regex tolerante ao apostrofo (reto/curvo) e a "im/i am interested": i.{0,2}m interested.
CREATE OR REPLACE FUNCTION public.get_organic_interested_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH first_msg AS (
    SELECT DISTINCT ON (session_id) session_id, message_text
    FROM public.interaction_db
    WHERE sender_type = 'client'
    ORDER BY session_id, timestamp ASC
  ),
  organic AS (
    SELECT l.session_id, l.sales_status
    FROM first_msg f
    JOIN public.lead_db_painel l ON l.session_id = f.session_id
    WHERE f.message_text ~* 'i.{0,2}m interested'
      AND (date_from IS NULL OR l.created_at >= date_from)
      AND (date_to   IS NULL OR l.created_at <= date_to)
  )
  SELECT json_build_object(
    'mensagens',  (SELECT COUNT(*) FROM organic),
    'agendamento',(SELECT COUNT(*) FROM organic
                    WHERE lower(COALESCE(sales_status, '')) LIKE '%agendamento%'
                       OR lower(COALESCE(sales_status, '')) LIKE '%confirmado%'
                       OR lower(COALESCE(sales_status, '')) LIKE '%ganha%'),
    'conversao',  (SELECT COUNT(*) FROM organic
                    WHERE lower(COALESCE(sales_status, '')) LIKE '%ganha%')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_organic_interested_kpis(timestamptz, timestamptz) TO anon, authenticated;
