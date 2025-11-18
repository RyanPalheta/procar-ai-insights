-- Remove campos de interaction_db
ALTER TABLE public.interaction_db 
DROP COLUMN IF EXISTS sentiment,
DROP COLUMN IF EXISTS ai_tags,
DROP COLUMN IF EXISTS processed;

-- Adicionar campos em lead_db
ALTER TABLE public.lead_db 
ADD COLUMN sentiment text,
ADD COLUMN ai_tags text[],
ADD COLUMN processed boolean DEFAULT false;