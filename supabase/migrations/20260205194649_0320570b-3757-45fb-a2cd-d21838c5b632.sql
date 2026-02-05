CREATE OR REPLACE FUNCTION get_conversion_by_quote_bracket(period_days integer DEFAULT NULL)
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
  period_start TIMESTAMP;
BEGIN
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH bracketed AS (
    SELECT 
      CASE 
        WHEN lead_price IS NULL OR lead_price = 0 THEN 'Sem Cotação'
        WHEN lead_price <= 500 THEN 'R$ 0-500'
        WHEN lead_price <= 1000 THEN 'R$ 500-1000'
        WHEN lead_price <= 2000 THEN 'R$ 1000-2000'
        ELSE 'R$ 2000+'
      END as bracket,
      lead_price,
      sales_status
    FROM lead_db
    WHERE last_ai_update IS NOT NULL
    AND (period_days IS NULL OR created_at >= period_start)
  )
  SELECT 
    b.bracket as quote_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (
      WHERE LOWER(b.sales_status) LIKE '%ganha%' 
         OR LOWER(b.sales_status) LIKE '%won%' 
         OR LOWER(b.sales_status) LIKE '%agendamento confirmado%'
    )::bigint as converted_leads,
    ROUND(
      COUNT(*) FILTER (
        WHERE LOWER(b.sales_status) LIKE '%ganha%' 
           OR LOWER(b.sales_status) LIKE '%won%' 
           OR LOWER(b.sales_status) LIKE '%agendamento confirmado%'
      ) * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate,
    ROUND(AVG(b.lead_price)::numeric, 2) as avg_quote_value
  FROM bracketed b
  GROUP BY b.bracket
  ORDER BY 
    CASE b.bracket 
      WHEN 'Sem Cotação' THEN 1 
      WHEN 'R$ 0-500' THEN 2 
      WHEN 'R$ 500-1000' THEN 3 
      WHEN 'R$ 1000-2000' THEN 4 
      ELSE 5 
    END;
END;
$$;