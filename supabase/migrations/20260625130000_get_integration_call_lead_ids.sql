-- 2026-06-25: lista os leads "vazios" criados pela NOSSA INTEGRAÇÃO de ligação
-- (ingest-call): channel='phone', têm registro em call_db e NÃO têm chat
-- (interaction_db). Usado pelo backfill da tag "Ligação Twilio" no Kommo.
CREATE OR REPLACE FUNCTION public.get_integration_call_lead_ids()
RETURNS TABLE(session_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.session_id
  FROM lead_db l
  WHERE lower(l.channel) = 'phone'
    AND l.is_duplicate IS NOT TRUE AND l.kommo_absent IS NOT TRUE
    AND EXISTS (SELECT 1 FROM call_db c WHERE c.session_id = l.session_id)
    AND NOT EXISTS (SELECT 1 FROM interaction_db i WHERE i.session_id = l.session_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_call_lead_ids() TO anon, authenticated;
