-- 2026-06-06: enriquece shopmonkey_appointment com walk-in / origem / vendedor
-- extraídos do note do agendamento por código puro (parseNote), substituindo a
-- detecção via IA/n8n. Guarda também o note bruto para transparência/auditoria.

ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS note    text;
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS walk_in boolean;
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS source  text;   -- origem (cliente antigo, indicação, google, instagram, website…)
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS seller  text;

CREATE INDEX IF NOT EXISTS idx_sm_appt_walkin ON public.shopmonkey_appointment (walk_in);
