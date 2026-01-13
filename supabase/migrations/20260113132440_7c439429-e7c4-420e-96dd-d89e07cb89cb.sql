-- Add need_summary column for storing a concise one-line summary of customer needs
ALTER TABLE public.lead_db 
ADD COLUMN IF NOT EXISTS need_summary TEXT;