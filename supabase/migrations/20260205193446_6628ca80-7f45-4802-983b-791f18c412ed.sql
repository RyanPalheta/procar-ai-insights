CREATE OR REPLACE FUNCTION get_conversion_by_response_time(period_days integer DEFAULT NULL)
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
BEGIN
  -- Define period boundary
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH ranked_interactions AS (
    SELECT 
      i.session_id,
      i.timestamp,
      ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.timestamp) as interaction_num
    FROM interaction_db i
    INNER JOIN lead_db l ON i.session_id = l.session_id
    WHERE i.session_id IS NOT NULL
    AND l.last_ai_update IS NOT NULL
    AND (period_days IS NULL OR l.created_at >= period_start)
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
  times_with_status AS (
    SELECT 
      rt.session_id,
      EXTRACT(EPOCH FROM (rt.t3 - rt.t1)) / 60 as response_minutes,
      l.sales_status
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
      sales_status
    FROM times_with_status
  )
  SELECT 
    b.bracket as time_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%' OR LOWER(b.sales_status) LIKE '%agendamento confirmado%')::bigint as converted_leads,
    ROUND(
      COUNT(*) FILTER (WHERE LOWER(b.sales_status) LIKE '%ganha%' OR LOWER(b.sales_status) LIKE '%won%' OR LOWER(b.sales_status) LIKE '%agendamento confirmado%') * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate
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