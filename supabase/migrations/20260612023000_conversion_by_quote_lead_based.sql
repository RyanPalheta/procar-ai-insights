-- Conversão por Cotação: de "todos os orçamentos da loja" para LEAD-BASED.
-- Antes: contava todo shopmonkey_order (inclusive walk-ins que chegam decididos),
-- o que inflava a taxa para ~93% e não media conversão de leads (auditoria 11/06).
-- Agora: universo = leads do painel (lead_db_painel) com orçamento no ShopMonkey
-- ligado pelo telefone e gerado após a chegada do lead; a faixa é o valor do
-- PRIMEIRO orçamento; convertido = lead_paid_conversion(phone, created_at) —
-- a MESMA definição de conversão do gráfico de Tempo de Resposta.

CREATE OR REPLACE FUNCTION public.get_conversion_by_quote_bracket(
  period_days integer DEFAULT NULL::integer,
  date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  date_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  quote_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric,
  avg_quote_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  period_start TIMESTAMPTZ;
BEGIN
  IF date_from IS NULL AND period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH leads AS (
    SELECT l.session_id, l.phone_normalized, l.created_at
    FROM lead_db_painel l
    WHERE l.phone_normalized IS NOT NULL
      AND (CASE
             WHEN date_from IS NOT NULL THEN l.created_at >= date_from AND (date_to IS NULL OR l.created_at <= date_to)
             WHEN period_start IS NOT NULL THEN l.created_at >= period_start
             ELSE TRUE
           END)
  ),
  first_quote AS (
    -- primeiro orçamento (não arquivado, valor > 0) gerado após a chegada do lead
    SELECT DISTINCT ON (ld.session_id)
      ld.session_id,
      ld.phone_normalized,
      ld.created_at,
      o.total_cost_cents / 100.0 AS valor
    FROM leads ld
    JOIN shopmonkey_customer c ON c.phone_normalized = ld.phone_normalized
    JOIN shopmonkey_order o ON o.customer_id = c.id
    WHERE COALESCE(o.archived, false) = false
      AND o.total_cost_cents > 0
      AND o.created_date >= ld.created_at
    ORDER BY ld.session_id, o.created_date ASC
  ),
  with_conv AS (
    SELECT
      fq.valor,
      public.lead_paid_conversion(fq.phone_normalized, fq.created_at) AS pago
    FROM first_quote fq
  ),
  bracketed AS (
    SELECT
      CASE
        WHEN valor <= 500 THEN '$0-500'
        WHEN valor <= 1000 THEN '$500-1000'
        WHEN valor <= 2000 THEN '$1000-2000'
        ELSE '$2000+'
      END AS bracket,
      valor,
      pago
    FROM with_conv
  )
  SELECT
    b.bracket AS quote_bracket,
    COUNT(*)::bigint AS total_leads,
    COUNT(*) FILTER (WHERE b.pago)::bigint AS converted_leads,
    ROUND(COUNT(*) FILTER (WHERE b.pago) * 100.0 / NULLIF(COUNT(*), 0), 1) AS conversion_rate,
    ROUND(AVG(b.valor)::numeric, 2) AS avg_quote_value
  FROM bracketed b
  GROUP BY b.bracket
  ORDER BY
    CASE b.bracket
      WHEN '$0-500' THEN 1
      WHEN '$500-1000' THEN 2
      WHEN '$1000-2000' THEN 3
      ELSE 4
    END;
END;
$function$;
