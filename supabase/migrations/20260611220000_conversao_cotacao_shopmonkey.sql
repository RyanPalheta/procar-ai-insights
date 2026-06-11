-- 2026-06-11 (pedido Pro Car, print 11:0x): "Conversão por Cotação" 100% ShopMonkey.
-- A versão anterior agrupava por lead_db.lead_price (cotação do chat, quase sempre
-- vazia -> tudo caía em "Sem Cotação"). A unidade certa é o ORÇAMENTO da loja:
--   gerados = shopmonkey_order criados no período (não arquivados, valor > 0);
--   pagos   = o próprio order pago (flag paid OU linha em shopmonkey_sale, que é
--             atualizada pelo sync por data de PAGAMENTO — cobre o order antigo
--             que só foi pago depois da janela de 2d do cron);
--   faixa   = valor total do orçamento (total_cost_cents/100, USD).
-- Conversão da faixa = pagos ÷ gerados. Some o bucket "Sem Cotação" (todo order
-- TEM valor; os de valor zero são rascunho e ficam fora). Nomes de colunas de
-- retorno mantidos p/ compatibilidade com o componente.

CREATE OR REPLACE FUNCTION get_conversion_by_quote_bracket(
  period_days integer DEFAULT NULL,
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL
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
AS $$
DECLARE
  period_start TIMESTAMPTZ;
BEGIN
  IF date_from IS NULL AND period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      o.total_cost_cents / 100.0 AS valor,
      (COALESCE(o.paid, false) OR EXISTS (SELECT 1 FROM shopmonkey_sale v WHERE v.id = o.id)) AS pago
    FROM shopmonkey_order o
    WHERE COALESCE(o.archived, false) = false
      AND o.total_cost_cents > 0
      AND (CASE
             WHEN date_from IS NOT NULL THEN o.created_date >= date_from AND (date_to IS NULL OR o.created_date <= date_to)
             WHEN period_start IS NOT NULL THEN o.created_date >= period_start
             ELSE TRUE
           END)
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
    FROM base
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
$$;
