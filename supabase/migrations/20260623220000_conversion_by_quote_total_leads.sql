-- 2026-06-23: "Conversão por Cotação" deve usar o TOTAL de leads como base
-- (mesma régua da Conversão de Venda), não só os leads que receberam orçamento.
-- Antes: taxa da faixa = pagos ÷ leads-com-orçamento-na-faixa (denominador
-- subconjunto, inflava). Agora: taxa da faixa = pagos da faixa ÷ TOTAL de leads
-- do período (lead_db_painel, que já exclui is_duplicate/kommo_absent e é o mesmo
-- total do card Conversão de Venda). A soma das faixas = pagos-via-orçamento ÷
-- total de leads.
--
-- Muda a assinatura de retorno (nova coluna bracket_leads = nº de orçamentos na
-- faixa, p/ contexto no tooltip), então DROP antes do CREATE.

DROP FUNCTION IF EXISTS public.get_conversion_by_quote_bracket(integer, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_conversion_by_quote_bracket(
  period_days integer DEFAULT NULL::integer,
  date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  date_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  quote_bracket text,
  total_leads bigint,       -- TOTAL de leads do período (denominador; igual p/ todas as faixas)
  converted_leads bigint,   -- desses, quantos pagaram (venda no ShopMonkey após a chegada)
  conversion_rate numeric,  -- convertidos da faixa ÷ TOTAL de leads do período × 100
  avg_quote_value numeric,
  bracket_leads bigint      -- nº de leads com orçamento nesta faixa (contexto)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  period_start TIMESTAMPTZ;
  v_total_leads BIGINT;
BEGIN
  IF date_from IS NULL AND period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  -- Base = TODOS os leads do período (mesmo total da Conversão de Venda).
  SELECT COUNT(*) INTO v_total_leads
  FROM lead_db_painel l
  WHERE (CASE
           WHEN date_from IS NOT NULL THEN l.created_at >= date_from AND (date_to IS NULL OR l.created_at <= date_to)
           WHEN period_start IS NOT NULL THEN l.created_at >= period_start
           ELSE TRUE
         END);

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
    v_total_leads AS total_leads,
    COUNT(*) FILTER (WHERE b.pago)::bigint AS converted_leads,
    ROUND(COUNT(*) FILTER (WHERE b.pago) * 100.0 / NULLIF(v_total_leads, 0), 1) AS conversion_rate,
    ROUND(AVG(b.valor)::numeric, 2) AS avg_quote_value,
    COUNT(*)::bigint AS bracket_leads
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

GRANT EXECUTE ON FUNCTION public.get_conversion_by_quote_bracket(integer, timestamptz, timestamptz) TO anon, authenticated;
