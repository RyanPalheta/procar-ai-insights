-- 2026-06-24: CONVERSAS de dias anteriores em andamento (checklist secao B, itens 7-12).
-- Card AMARELO. "Conversa em andamento" = lead AINDA ABERTO (status nao ganha/perdida)
-- que teve interacao no periodo em DIA DIFERENTE do created_at do lead. Quebra por canal.
-- FB/IG quase nao tem outbound de agente (41/24 msgs) -> numero desses canais e piso.
-- Agendamento cruzado com created_at do lead NAO e confiavel (sem chave appointment<->lead),
-- por isso entregamos so conversas+canais; o disclaimer "?" explica a limitacao.
CREATE OR REPLACE FUNCTION public.get_ongoing_conversations_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ong AS (
    SELECT DISTINCT i.session_id, lower(i.channel) AS channel
    FROM public.interaction_db i
    JOIN public.lead_db_painel l ON l.session_id = i.session_id
    WHERE (date_from IS NULL OR i.timestamp >= date_from)
      AND (date_to   IS NULL OR i.timestamp <= date_to)
      AND i.timestamp::date > l.created_at::date
      AND lower(COALESCE(l.sales_status, '')) NOT LIKE '%ganha%'
      AND lower(COALESCE(l.sales_status, '')) NOT LIKE '%perdida%'
  )
  SELECT json_build_object(
    'ongoing_total',     (SELECT COUNT(DISTINCT session_id) FROM ong),
    'ongoing_whatsapp',  (SELECT COUNT(DISTINCT session_id) FROM ong WHERE channel = 'whatsapp'),
    'ongoing_facebook',  (SELECT COUNT(DISTINCT session_id) FROM ong WHERE channel = 'facebook'),
    'ongoing_instagram', (SELECT COUNT(DISTINCT session_id) FROM ong WHERE channel = 'instagram')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_ongoing_conversations_kpis(timestamptz, timestamptz) TO anon, authenticated;
