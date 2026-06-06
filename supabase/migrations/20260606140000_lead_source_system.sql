-- 2026-06-06: marca a origem do registro no lead_db. Os leads trazidos da Kommo
-- pela sync-kommo recebem source_system='kommo_sync'; leads de chat ficam NULL.
-- Permite distinguir/auditar e torna a sync idempotente (insert-only por session_id).
ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS source_system text;
CREATE INDEX IF NOT EXISTS idx_lead_source_system ON public.lead_db (source_system);
