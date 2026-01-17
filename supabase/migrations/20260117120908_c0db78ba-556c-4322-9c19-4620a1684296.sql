ALTER TABLE public.lead_db 
ADD COLUMN is_walking boolean DEFAULT false;

COMMENT ON COLUMN public.lead_db.is_walking IS 'Indica se o lead foi fisicamente à empresa (walking customer)';