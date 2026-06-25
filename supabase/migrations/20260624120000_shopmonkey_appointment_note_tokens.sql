-- 2026-06-24: enriquece shopmonkey_appointment com tokens DETERMINÍSTICOS extraídos
-- do note do agendamento (parseNote), para os cards do backlog:
--   upsell             -> itens de "(UPSELL: LED, SOUND SYSTEM - JP)" (1 cada)   [BLOCO upsell]
--   financing          -> SNAP / ACIMA / AMERICAN FIRST (separados por vírgula)  [BLOCO N]
--   is_referral        -> note menciona "INDICACAO"/indicação (em qualquer lugar) [BLOCO K]
--   is_absoluto        -> note contém "absoluto"                                 [BLOCO G]
--   phone_active_booking -> "APONTAMENTO MARCADO VIA TELEFONE ATIVO"             [BLOCO J]
-- Mantém o note bruto (já gravado) para auditoria. Reprocessado a cada sync-shopmonkey
-- (upsert idempotente por id), então basta re-rodar o sync para popular o histórico.

ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS upsell               text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS financing            text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS is_referral          boolean NOT NULL DEFAULT false;
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS is_absoluto          boolean NOT NULL DEFAULT false;
ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS phone_active_booking boolean NOT NULL DEFAULT false;

-- GIN p/ as contagens por item (unnest/array-contains) de upsell e financiamento.
CREATE INDEX IF NOT EXISTS idx_sm_appt_upsell    ON public.shopmonkey_appointment USING gin (upsell);
CREATE INDEX IF NOT EXISTS idx_sm_appt_financing ON public.shopmonkey_appointment USING gin (financing);
-- B-tree parciais p/ os cards de flag (poucas linhas true).
CREATE INDEX IF NOT EXISTS idx_sm_appt_referral  ON public.shopmonkey_appointment (is_referral) WHERE is_referral;
CREATE INDEX IF NOT EXISTS idx_sm_appt_absoluto  ON public.shopmonkey_appointment (is_absoluto) WHERE is_absoluto;
CREATE INDEX IF NOT EXISTS idx_sm_appt_phone_act ON public.shopmonkey_appointment (phone_active_booking) WHERE phone_active_booking;
