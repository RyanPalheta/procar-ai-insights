-- 2026-06-05: Add optional calendar-range params (date_from / date_to) to the
-- five period-aware KPI / breakdown RPCs, while keeping the existing
-- `period_days` rolling-window behavior 100% backward compatible.
--
-- New signature for each function (params are positional in Postgres, so the two
-- new ones are appended AFTER period_days and both DEFAULT NULL):
--     fn(period_days integer DEFAULT NULL,
--        date_from   timestamptz DEFAULT NULL,
--        date_to     timestamptz DEFAULT NULL)
--
-- Resolution precedence (per function):
--   1. date_from IS NOT NULL  -> explicit calendar range. Current window is the
--      CLOSED interval [date_from, date_to] (created_at >= date_from AND
--      created_at <= date_to). Where a previous/delta period exists
--      (get_leads_kpis only), it is the equal-length window immediately before:
--      prev_start := date_from - (date_to - date_from); prev_end := date_from,
--      filtered HALF-OPEN [prev_start, date_from) so date_from is never double
--      counted. A single calendar day works when the caller passes
--      date_from = start-of-day and date_to = end-of-day.
--   2. date_from IS NULL AND period_days IS NOT NULL -> the ORIGINAL rolling
--      window: period_start := NOW() - period_days days; previous window
--      [NOW()-2*period_days, NOW()-period_days). Byte-for-byte unchanged.
--   3. both NULL -> all-time, exactly as before.
--
-- Back-compat: every existing caller (no args, or period_days only) hits the
-- unchanged code paths and returns identical numbers. The added
-- `(... <= date_to)` / range predicates are no-ops when date_from IS NULL.
--
-- NOTE on types: period_start / period_end are declared TIMESTAMP (as in the
-- originals). Assigning a timestamptz (date_from/date_to or NOW()) into them and
-- comparing against created_at (timestamptz) coerces via the session TimeZone --
-- this is the same behavior the originals already relied on for NOW(), so it is
-- preserved, not introduced. Callers should pass date_from/date_to already in
-- the desired zone (typically UTC) to avoid TimeZone-dependent edges.

-- Drop the stale 1-arg (period_days only) overloads FIRST. Appending the two new
-- params changes the argument-type list, so CREATE OR REPLACE would otherwise
-- leave the old 1-arg functions in place as separate overloads, making no-arg /
-- period_days-only calls ambiguous (e.g. the zero-arg get_cold_audit_kpis() call
-- in src/pages/Leads.tsx -> "function ... is not unique").
DROP FUNCTION IF EXISTS public.get_leads_kpis(integer);
DROP FUNCTION IF EXISTS public.get_sellers_kpis(integer);
DROP FUNCTION IF EXISTS public.get_conversion_by_response_time(integer);
DROP FUNCTION IF EXISTS public.get_conversion_by_quote_bracket(integer);
DROP FUNCTION IF EXISTS public.get_cold_audit_kpis(integer);

-- =========================================================================
-- 1. get_leads_kpis  (computes a previous/delta period)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_leads_kpis(period_days integer DEFAULT NULL::integer, date_from timestamptz DEFAULT NULL::timestamptz, date_to timestamptz DEFAULT NULL::timestamptz)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  period_end TIMESTAMP;
  previous_period_start TIMESTAMP;
  previous_period_end TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    -- Explicit calendar date range: current = [date_from, date_to],
    -- previous = equal-length window immediately before [prev_start, date_from).
    period_start := date_from;
    period_end := date_to;
    previous_period_start := date_from - (date_to - date_from);
    previous_period_end := date_from;
  ELSIF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
    period_end := NULL;
    previous_period_end := period_start;
    previous_period_start := NOW() - (period_days * 2 || ' days')::INTERVAL;
  END IF;

  SELECT json_build_object(
    'total_audited', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL)
    END,
    'total_audited_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'won_leads', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%'))
    END,
    'won_leads_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%' OR LOWER(sales_status) LIKE '%agendamento confirmado%') AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_score', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL)
    END,
    'avg_score_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_score)::numeric, 1), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_score IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'new_audited_24h', (SELECT COUNT(*) FROM lead_db WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'new_audited_24h_previous', (SELECT COUNT(*) FROM lead_db WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours'),
    'leads_with_quote', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL)
    END,
    'leads_with_quote_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'avg_quoted_price', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL)
    END,
    'avg_quoted_price_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(ROUND(AVG(lead_price)::numeric, 2), 0) FROM lead_db WHERE last_ai_update IS NOT NULL AND lead_price IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'median_first_response_time_minutes', CASE 
      WHEN period_start IS NOT NULL THEN
        (WITH ranked_interactions AS (
          SELECT i.session_id, i.timestamp, ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.timestamp) as interaction_num
          FROM interaction_db i INNER JOIN lead_db l ON i.session_id = l.session_id
          WHERE i.session_id IS NOT NULL AND l.created_at >= period_start AND (period_end IS NULL OR l.created_at <= period_end)
        ), first_three AS (
          SELECT session_id, MAX(CASE WHEN interaction_num = 1 THEN timestamp END) as t1, MAX(CASE WHEN interaction_num = 3 THEN timestamp END) as t3
          FROM ranked_interactions WHERE interaction_num <= 3 GROUP BY session_id HAVING COUNT(*) >= 3
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t3 - t1)) / 60)::numeric, 1), 0) FROM first_three)
      ELSE
        (WITH ranked_interactions AS (
          SELECT session_id, timestamp, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) as interaction_num
          FROM interaction_db WHERE session_id IS NOT NULL
        ), first_three AS (
          SELECT session_id, MAX(CASE WHEN interaction_num = 1 THEN timestamp END) as t1, MAX(CASE WHEN interaction_num = 3 THEN timestamp END) as t3
          FROM ranked_interactions WHERE interaction_num <= 3 GROUP BY session_id HAVING COUNT(*) >= 3
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t3 - t1)) / 60)::numeric, 1), 0) FROM first_three)
    END,
    'median_first_response_time_minutes_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (WITH ranked_interactions AS (
          SELECT i.session_id, i.timestamp, ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.timestamp) as interaction_num
          FROM interaction_db i INNER JOIN lead_db l ON i.session_id = l.session_id
          WHERE i.session_id IS NOT NULL AND l.created_at >= previous_period_start AND l.created_at < previous_period_end
        ), first_three AS (
          SELECT session_id, MAX(CASE WHEN interaction_num = 1 THEN timestamp END) as t1, MAX(CASE WHEN interaction_num = 3 THEN timestamp END) as t3
          FROM ranked_interactions WHERE interaction_num <= 3 GROUP BY session_id HAVING COUNT(*) >= 3
        )
        SELECT COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t3 - t1)) / 60)::numeric, 1), 0) FROM first_three)
      ELSE NULL
    END,
    'walking_leads', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE is_walking = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE is_walking = true AND last_ai_update IS NOT NULL)
    END,
    'walking_leads_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE is_walking = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'upsell_leads', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_leads_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COUNT(*) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END,
    'upsell_total_value', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= period_start AND (period_end IS NULL OR created_at <= period_end))
      ELSE
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL)
    END,
    'upsell_total_value_previous', CASE 
      WHEN period_start IS NOT NULL THEN
        (SELECT COALESCE(SUM(upsell_value_estimate), 0) FROM lead_db WHERE has_upsell = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
      ELSE NULL
    END
  ) INTO result;
  
  RETURN result;
END;
$function$;

-- =========================================================================
-- 2. get_sellers_kpis  (no previous/delta in original; preserved as such)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_sellers_kpis(period_days integer DEFAULT NULL, date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  period_end TIMESTAMP;
  previous_period_start TIMESTAMP;
  previous_period_end TIMESTAMP;
  prev_start TIMESTAMP;
  prev_end TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    -- Explicit calendar date range: current period = [date_from, date_to]
    period_start := date_from;
    period_end := date_to;
    -- Previous period bounds computed for parity with other RPCs, but (as in the
    -- original) this function returns only current-period aggregates.
    prev_start := date_from - (date_to - date_from);
    prev_end := date_from;
  ELSE
    -- Existing period_days behavior (NULL period_days = all-time) -- unchanged
    IF period_days IS NOT NULL THEN
      period_start := NOW() - (period_days || ' days')::INTERVAL;
      previous_period_end := period_start;
      previous_period_start := NOW() - (period_days * 2 || ' days')::INTERVAL;
    END IF;
  END IF;

  SELECT json_agg(seller_row) INTO result
  FROM (
    SELECT
      l.sales_person_id as seller_id,
      -- Current period
      COUNT(*) as total_audited,
      COUNT(*) FILTER (WHERE LOWER(l.sales_status) LIKE '%ganha%' OR LOWER(l.sales_status) LIKE '%won%' OR LOWER(l.sales_status) LIKE '%agendamento confirmado%') as won_leads,
      COALESCE(ROUND(AVG(l.lead_score)::numeric, 1), 0) as avg_score,
      COUNT(*) FILTER (WHERE l.created_at >= NOW() - INTERVAL '24 hours') as new_audited_24h,
      COUNT(*) FILTER (WHERE l.lead_price IS NOT NULL) as leads_with_quote,
      COALESCE(ROUND(AVG(l.lead_price) FILTER (WHERE l.lead_price IS NOT NULL)::numeric, 2), 0) as avg_quoted_price,
      COUNT(*) FILTER (WHERE l.is_walking = true) as walking_leads,
      COUNT(*) FILTER (WHERE l.has_objection = true) as total_with_objection,
      COUNT(*) FILTER (WHERE l.has_objection = true AND l.objection_overcome = true) as objections_overcome
    FROM lead_db l
    WHERE l.last_ai_update IS NOT NULL
      AND l.sales_person_id IS NOT NULL
      AND l.sales_person_id != ''
      AND (
        (date_from IS NOT NULL
          AND l.created_at >= period_start
          AND l.created_at <= period_end)
        OR
        (date_from IS NULL
          AND (period_days IS NULL OR l.created_at >= period_start))
      )
    GROUP BY l.sales_person_id
    ORDER BY COUNT(*) DESC
  ) seller_row;

  -- If no results, return empty array
  IF result IS NULL THEN
    result := '[]'::json;
  END IF;

  RETURN result;
END;
$$;

-- =========================================================================
-- 3. get_conversion_by_response_time  (no previous/delta)
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
  -- Define period boundary
  IF date_from IS NOT NULL THEN
    -- Explicit calendar date range: current period = [date_from, date_to]
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
    INNER JOIN lead_db l ON i.session_id = l.session_id
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

-- =========================================================================
-- 4. get_conversion_by_quote_bracket  (no previous/delta)
-- =========================================================================
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
  period_start TIMESTAMP;
BEGIN
  IF date_from IS NOT NULL THEN
    -- Explicit calendar range: use [date_from, date_to] directly in the filter.
    NULL;
  ELSE
    -- Existing behavior: period_days path (NULL period_days = all-time).
    IF period_days IS NOT NULL THEN
      period_start := NOW() - (period_days || ' days')::INTERVAL;
    END IF;
  END IF;

  RETURN QUERY
  WITH bracketed AS (
    SELECT
      CASE
        WHEN lead_price IS NULL OR lead_price = 0 THEN 'Sem Cotação'
        WHEN lead_price <= 500 THEN '$0-500'
        WHEN lead_price <= 1000 THEN '$500-1000'
        WHEN lead_price <= 2000 THEN '$1000-2000'
        ELSE '$2000+'
      END as bracket,
      lead_price,
      sales_status
    FROM lead_db
    WHERE last_ai_update IS NOT NULL
    AND (
      CASE
        WHEN date_from IS NOT NULL THEN created_at >= date_from AND created_at <= date_to
        ELSE (period_days IS NULL OR created_at >= period_start)
      END
    )
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
      WHEN '$0-500' THEN 2
      WHEN '$500-1000' THEN 3
      WHEN '$1000-2000' THEN 4
      ELSE 5
    END;
END;
$$;

-- =========================================================================
-- 5. get_cold_audit_kpis  (no previous/delta)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_cold_audit_kpis(period_days integer DEFAULT NULL::integer, date_from timestamptz DEFAULT NULL::timestamptz, date_to timestamptz DEFAULT NULL::timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  use_range BOOLEAN := false;
BEGIN
  IF date_from IS NOT NULL THEN
    -- Explicit calendar range: current period = [date_from, date_to]
    use_range := true;
  ELSIF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  SELECT json_build_object(
    'total_cold', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL
      AND (
        (use_range AND created_at >= date_from AND created_at <= date_to)
        OR (NOT use_range AND (period_days IS NULL OR created_at >= period_start))
      )
    ),
    'without_followup', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL AND cold_audit_followup_ok = false
      AND (
        (use_range AND created_at >= date_from AND created_at <= date_to)
        OR (NOT use_range AND (period_days IS NULL OR created_at >= period_start))
      )
    ),
    'reactivatable', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL AND cold_audit_reactivation_chance IN ('alta', 'media')
      AND (
        (use_range AND created_at >= date_from AND created_at <= date_to)
        OR (NOT use_range AND (period_days IS NULL OR created_at >= period_start))
      )
    ),
    'followup_ok_rate', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE cold_audit_followup_ok = true) * 100.0 / NULLIF(COUNT(*), 0), 1
        ), 0
      )
      FROM lead_db 
      WHERE cold_audit_at IS NOT NULL
      AND (
        (use_range AND created_at >= date_from AND created_at <= date_to)
        OR (NOT use_range AND (period_days IS NULL OR created_at >= period_start))
      )
    ),
    'by_reactivation_chance', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cold_audit_reactivation_chance as chance, COUNT(*) as count
        FROM lead_db
        WHERE cold_audit_at IS NOT NULL
        AND (
          (use_range AND created_at >= date_from AND created_at <= date_to)
          OR (NOT use_range AND (period_days IS NULL OR created_at >= period_start))
        )
        GROUP BY cold_audit_reactivation_chance
        ORDER BY count DESC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;
