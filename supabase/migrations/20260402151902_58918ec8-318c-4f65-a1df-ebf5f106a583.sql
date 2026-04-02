
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS cold_audit_reason TEXT;
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS cold_audit_followup_ok BOOLEAN;
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS cold_audit_reactivation_chance TEXT;
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS cold_audit_suggestion TEXT;
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS cold_audit_at TIMESTAMPTZ;
ALTER TABLE lead_db ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_cold_audit_kpis(period_days integer DEFAULT NULL::integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  period_start TIMESTAMP;
BEGIN
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  SELECT json_build_object(
    'total_cold', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL
      AND (period_days IS NULL OR created_at >= period_start)
    ),
    'without_followup', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL AND cold_audit_followup_ok = false
      AND (period_days IS NULL OR created_at >= period_start)
    ),
    'reactivatable', (
      SELECT COUNT(*) FROM lead_db 
      WHERE cold_audit_at IS NOT NULL AND cold_audit_reactivation_chance IN ('alta', 'media')
      AND (period_days IS NULL OR created_at >= period_start)
    ),
    'followup_ok_rate', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE cold_audit_followup_ok = true) * 100.0 / NULLIF(COUNT(*), 0), 1
        ), 0
      )
      FROM lead_db 
      WHERE cold_audit_at IS NOT NULL
      AND (period_days IS NULL OR created_at >= period_start)
    ),
    'by_reactivation_chance', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT cold_audit_reactivation_chance as chance, COUNT(*) as count
        FROM lead_db
        WHERE cold_audit_at IS NOT NULL
        AND (period_days IS NULL OR created_at >= period_start)
        GROUP BY cold_audit_reactivation_chance
        ORDER BY count DESC
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;
