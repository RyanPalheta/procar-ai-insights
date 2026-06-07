-- 2026-06-06: get_conversion_by_response_time passa a usar o tempo REAL de 1a resposta
-- (cliente -> agente), a MESMA regra do get_leads_kpis (migration 20260606200000) e da
-- aba Canais, em vez do proxy antigo t1->t3 (intervalo entre a 1a e a 3a interacao), que
-- a auditoria marcou "irreal". Mantem inalterado: conversao = SO VENDA (ganha/won),
-- filtro de IA (last_ai_update IS NOT NULL) e amostra de chat com >= 3 mensagens.
-- SOMENTE o calculo do TEMPO muda; faixas (0-15/15-30/30-60/60+) e definicao de conversao
-- permanecem identicas a 20260606300000.

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
  WITH base AS (
    SELECT
      i.session_id  AS session_id,
      i.timestamp   AS ts,
      i.sender_type AS sender_type
    FROM interaction_db i
    INNER JOIN lead_db l ON i.session_id = l.session_id
    WHERE i.session_id IS NOT NULL
      AND l.last_ai_update IS NOT NULL
      AND (
        (use_range AND l.created_at >= period_start AND l.created_at <= period_end)
        OR
        (NOT use_range AND (period_days IS NULL OR l.created_at >= period_start))
      )
  ),
  -- amostra de chat: conversas com >= 3 mensagens (mantido da versao anterior)
  eligible AS (
    SELECT session_id FROM base GROUP BY session_id HAVING COUNT(*) >= 3
  ),
  -- 1a mensagem de quem NAO e agente (o cliente)
  fc AS (
    SELECT b.session_id, MIN(b.ts) AS first_client
    FROM base b JOIN eligible e ON b.session_id = e.session_id
    WHERE b.sender_type IS DISTINCT FROM 'agent'
    GROUP BY b.session_id
  ),
  -- 1a resposta do agente DEPOIS da 1a do cliente
  fa AS (
    SELECT b.session_id, MIN(b.ts) AS first_agent
    FROM base b JOIN fc ON b.session_id = fc.session_id
    WHERE b.sender_type = 'agent' AND b.ts > fc.first_client
    GROUP BY b.session_id
  ),
  times_with_status AS (
    SELECT
      fc.session_id,
      EXTRACT(EPOCH FROM (fa.first_agent - fc.first_client)) / 60 AS response_minutes,
      l.sales_status
    FROM fc
    JOIN fa ON fc.session_id = fa.session_id
    INNER JOIN lead_db l ON fc.session_id = l.session_id
  ),
  bracketed AS (
    SELECT
      CASE
        WHEN response_minutes <= 15 THEN '0-15 min'
        WHEN response_minutes <= 30 THEN '15-30 min'
        WHEN response_minutes <= 60 THEN '30-60 min'
        ELSE '60+ min'
      END AS bracket,
      sales_status
    FROM times_with_status
  )
  SELECT
    b.bracket AS time_bracket,
    COUNT(*)::bigint AS total_leads,
    COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%')::bigint AS converted_leads,
    ROUND(
      COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%') * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) AS conversion_rate
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
