-- 2026-06-25: separa ORGANICO x TRAFEGO (checklist secao D).
-- Antes havia so um grupo de cards ("I'm interested") rotulado erroneamente como
-- "Organico". O correto sao DOIS grupos, pela PRIMEIRA mensagem do cliente:
--   * TRAFEGO  = a 1a msg casa o template de anuncio Meta "I'm interested in <produto>"
--                (FB/IG click-to-message e click-to-WhatsApp) -> trafego PAGO.
--   * ORGANICO = a 1a msg NAO casa esse template -> entrou pelo WhatsApp de forma
--                espontanea (organico).
-- Regex tolerante ao apostrofo (reto/curvo) e a "im/i am interested": i.{0,2}m interested.
-- Base: leads que de fato iniciaram um chat (existe 1a msg do cliente em interaction_db).
-- Leads sem chat (so telefone/walk-in) nao entram em nenhum dos dois grupos.
CREATE OR REPLACE FUNCTION public.get_organic_vs_traffic_kpis(
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
  classified AS (
    SELECT l.session_id,
           l.sales_status,
           (f.message_text ~* 'i.{0,2}m interested') AS is_traffic
    FROM first_msg f
    JOIN public.lead_db_painel l ON l.session_id = f.session_id
    WHERE (date_from IS NULL OR l.created_at >= date_from)
      AND (date_to   IS NULL OR l.created_at <= date_to)
  )
  SELECT json_build_object(
    'organico', json_build_object(
      'mensagens',   COUNT(*) FILTER (WHERE NOT is_traffic),
      'agendamento', COUNT(*) FILTER (WHERE NOT is_traffic AND (
                       lower(COALESCE(sales_status, '')) LIKE '%agendamento%'
                    OR lower(COALESCE(sales_status, '')) LIKE '%confirmado%'
                    OR lower(COALESCE(sales_status, '')) LIKE '%ganha%')),
      'vendas',      COUNT(*) FILTER (WHERE NOT is_traffic AND
                       lower(COALESCE(sales_status, '')) LIKE '%ganha%')
    ),
    'trafego', json_build_object(
      'mensagens',   COUNT(*) FILTER (WHERE is_traffic),
      'agendamento', COUNT(*) FILTER (WHERE is_traffic AND (
                       lower(COALESCE(sales_status, '')) LIKE '%agendamento%'
                    OR lower(COALESCE(sales_status, '')) LIKE '%confirmado%'
                    OR lower(COALESCE(sales_status, '')) LIKE '%ganha%')),
      'vendas',      COUNT(*) FILTER (WHERE is_traffic AND
                       lower(COALESCE(sales_status, '')) LIKE '%ganha%')
    )
  )
  FROM classified;
$$;

GRANT EXECUTE ON FUNCTION public.get_organic_vs_traffic_kpis(timestamptz, timestamptz) TO anon, authenticated;
