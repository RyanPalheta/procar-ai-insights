
CREATE OR REPLACE FUNCTION public.get_leads_kpis(period_days integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  previous_period_start TIMESTAMP;
  previous_period_end TIMESTAMP;
BEGIN
  -- Define period boundaries
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
    previous_period_end := period_start;
    previous_period_start := NOW() - (period_days * 2 || ' days')::INTERVAL;
  END IF;

  SELECT json_build_object(
    -- Total de leads auditados (base para conversão)
    'total_audited', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND created_at >= period_start)
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL)
    END,
    
    -- Total auditados período anterior
    'total_audited_previous', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL 
         AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    
    -- Leads ganhos (usando LIKE para capturar variações)
    'won_leads', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL 
         AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%')
         AND created_at >= period_start)
      ELSE
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL 
         AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%'))
    END,
    
    -- Leads ganhos período anterior
    'won_leads_previous', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL 
         AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%')
         AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    
    -- Score médio dos leads auditados
    'avg_score', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL 
         AND created_at >= period_start)
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL)
    END,
    
    -- Score do período anterior (para variação)
    'avg_score_previous', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL 
         AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    
    -- Novos leads CRIADOS nas últimas 24h
    'new_audited_24h', (SELECT COUNT(*) FROM lead_db 
                        WHERE created_at >= NOW() - INTERVAL '24 hours'),
    
    -- Novos leads das 24h anteriores (para comparação)
    'new_audited_24h_previous', (SELECT COUNT(*) FROM lead_db 
                                  WHERE created_at >= NOW() - INTERVAL '48 hours' 
                                  AND created_at < NOW() - INTERVAL '24 hours'),
    
    -- Leads auditados com cotação
    'leads_with_quote', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL 
         AND created_at >= period_start)
      ELSE
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL)
    END,
    
    -- Leads com cotação do período anterior
    'leads_with_quote_previous', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL 
         AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    
    -- Preço médio cotado
    'avg_quoted_price', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL
         AND created_at >= period_start)
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL)
    END,
    
    -- Preço médio cotado período anterior
    'avg_quoted_price_previous', CASE 
      WHEN period_days IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) 
         FROM lead_db 
         WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL
         AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END
  ) INTO result;
  
  RETURN result;
END;
$function$;
