-- 2026-06-11 (pedido Pro Car, print 10:50): os gráficos "Conversão por Tempo de
-- Resposta" e "Conversão por Cotação" devem contar como convertido o lead cujo
-- ORÇAMENTO FOI PAGO no ShopMonkey — não mais o status "ganha" da Kommo.
--
-- Ponte lead -> venda paga: telefone. shopmonkey_customer (novo, populado pelo
-- sync-shopmonkey) guarda o telefone do cliente da loja; o lead tem
-- phone_normalized (espelhado da Kommo pelo sync-kommo, agora para TODAS as
-- linhas). Convertido = existe venda paga (shopmonkey_sale) de um cliente com o
-- MESMO telefone, paga DEPOIS de o lead chegar (coorte).

CREATE TABLE IF NOT EXISTS public.shopmonkey_customer (
  id               text PRIMARY KEY,        -- ShopMonkey customer id
  phone            text,
  phone_normalized text,                    -- últimos 10 dígitos (chave da ponte)
  synced_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_customer_phone ON public.shopmonkey_customer (phone_normalized) WHERE phone_normalized IS NOT NULL;

ALTER TABLE public.shopmonkey_customer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_shopmonkey_customer" ON public.shopmonkey_customer;
CREATE POLICY "read_shopmonkey_customer" ON public.shopmonkey_customer
  FOR SELECT TO anon, authenticated USING (true);

-- Helper: o lead converteu? (orçamento pago de cliente com o mesmo telefone,
-- pago depois da chegada do lead)
CREATE OR REPLACE FUNCTION public.lead_paid_conversion(p_phone text, p_created timestamptz)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_phone IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shopmonkey_sale v
    JOIN public.shopmonkey_customer c ON c.id = v.customer_id
    WHERE c.phone_normalized = p_phone
      AND v.fully_paid_date >= p_created
  );
$$;

-- =========================================================================
-- get_conversion_by_response_time: convertido = ORÇAMENTO PAGO (via telefone).
-- =========================================================================
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
  WITH ranked_interactions AS (
    SELECT
      i.session_id,
      i.timestamp,
      ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.timestamp) as interaction_num
    FROM interaction_db i
    INNER JOIN lead_db_painel l ON i.session_id = l.session_id
    WHERE i.session_id IS NOT NULL
    AND l.last_ai_update IS NOT NULL
    AND (
      (use_range
        AND l.created_at >= period_start AND l.created_at <= period_end)
      OR
      (NOT use_range
        AND (period_days IS NULL OR l.created_at >= period_start))
    )
  ),
  response_times AS (
    SELECT
      r.session_id,
      MAX(CASE WHEN r.interaction_num = 1 THEN r.timestamp END) as t1,
      MAX(CASE WHEN r.interaction_num = 3 THEN r.timestamp END) as t3
    FROM ranked_interactions r
    WHERE r.interaction_num <= 3
    GROUP BY r.session_id
    HAVING COUNT(*) >= 3
  ),
  times_with_conv AS (
    SELECT
      rt.session_id,
      EXTRACT(EPOCH FROM (rt.t3 - rt.t1)) / 60 as response_minutes,
      public.lead_paid_conversion(l.phone_normalized, l.created_at) AS converted
    FROM response_times rt
    INNER JOIN lead_db l ON rt.session_id = l.session_id
  ),
  bracketed AS (
    SELECT
      CASE
        WHEN response_minutes <= 15 THEN '0-15 min'
        WHEN response_minutes <= 30 THEN '15-30 min'
        WHEN response_minutes <= 60 THEN '30-60 min'
        ELSE '60+ min'
      END as bracket,
      converted
    FROM times_with_conv
  )
  SELECT
    b.bracket as time_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE b.converted)::bigint as converted_leads,
    ROUND(COUNT(*) FILTER (WHERE b.converted) * 100.0 / NULLIF(COUNT(*), 0), 1) as conversion_rate
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

-- NOTA (mesma data, print 11:0x): get_conversion_by_quote_bracket NÃO é mais
-- redefinida aqui — a Pro Car pediu o gráfico 100% ShopMonkey (orçamentos gerados
-- × pagos por faixa de VALOR DO ORDER, sem ponte por telefone). Ver
-- 20260611220000_conversao_cotacao_shopmonkey.sql, que é a definição vigente.
