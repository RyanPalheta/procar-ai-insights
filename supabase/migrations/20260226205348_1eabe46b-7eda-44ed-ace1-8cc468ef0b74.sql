
-- 1. Create seller_goals table
CREATE TABLE public.seller_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text NULL, -- NULL = global fallback goal
  metric text NOT NULL,
  target numeric NOT NULL,
  direction text NOT NULL DEFAULT '>=',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id, metric)
);

-- 2. Enable RLS
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

-- 3. RLS: authenticated can read
CREATE POLICY "Authenticated users can read seller_goals"
  ON public.seller_goals FOR SELECT TO authenticated
  USING (true);

-- 4. RLS: only admin can insert
CREATE POLICY "Admins can insert seller_goals"
  ON public.seller_goals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. RLS: only admin can update
CREATE POLICY "Admins can update seller_goals"
  ON public.seller_goals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS: only admin can delete
CREATE POLICY "Admins can delete seller_goals"
  ON public.seller_goals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create get_sellers_kpis RPC
CREATE OR REPLACE FUNCTION public.get_sellers_kpis(period_days integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  period_start TIMESTAMP;
  previous_period_start TIMESTAMP;
  previous_period_end TIMESTAMP;
BEGIN
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
    previous_period_end := period_start;
    previous_period_start := NOW() - (period_days * 2 || ' days')::INTERVAL;
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
      AND (period_days IS NULL OR l.created_at >= period_start)
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
