-- 2026-06-06: fundação da dedup por telefone (Fase 1 — ADITIVA, sem efeito em KPIs).
-- Cria onde gravar o telefone do lead para, depois, casar chat <-> Kommo. Nenhum leitor
-- referencia phone ainda, então este passo tem efeito ZERO sobre os números atuais.
ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS phone_normalized text;  -- só dígitos, últimos 10 (chave de dedup)
CREATE INDEX IF NOT EXISTS idx_lead_phone_norm ON public.lead_db (phone_normalized);
