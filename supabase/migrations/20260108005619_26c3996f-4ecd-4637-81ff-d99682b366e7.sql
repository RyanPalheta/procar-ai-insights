-- Create a function to get interaction counts (workaround for view type issues)
CREATE OR REPLACE FUNCTION public.get_interaction_counts()
RETURNS TABLE(session_id integer, message_count integer)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    session_id::integer, 
    COUNT(*)::integer as message_count
  FROM public.interaction_db
  WHERE session_id IS NOT NULL
  GROUP BY session_id;
$$;