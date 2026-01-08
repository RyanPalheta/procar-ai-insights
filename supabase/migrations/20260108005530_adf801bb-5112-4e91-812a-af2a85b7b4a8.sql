-- Create a view to aggregate interaction counts by session_id
-- This solves the 1000 record limit issue by doing aggregation in the database
CREATE VIEW public.interaction_counts AS
SELECT 
  session_id, 
  COUNT(*)::integer as message_count
FROM public.interaction_db
WHERE session_id IS NOT NULL
GROUP BY session_id;