-- Add service_rating column to lead_db
ALTER TABLE public.lead_db ADD COLUMN service_rating numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.lead_db.service_rating IS 'Service rating from 1 to 10 based on lead_score and playbook_compliance_score';