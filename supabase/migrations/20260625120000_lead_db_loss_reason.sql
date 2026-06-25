-- 2026-06-25: motivo de perda do Kommo em lead_db.loss_reason (checklist N #50 Local
-- distante). O painel só tinha a objeção da IA (objection_categories, derivada do chat);
-- quando a equipe marca o MOTIVO DE PERDA no Kommo (ex.: "Local distante") ao mover o
-- lead p/ "Venda perdida", isso NÃO chegava ao painel. Agora o sync-kommo lê o
-- loss_reason (with=loss_reason) e grava aqui, e o card de "Local Distante" passa a
-- contar tanto pela objeção da IA quanto pelo motivo de perda do Kommo.
ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS loss_reason text;
CREATE INDEX IF NOT EXISTS idx_lead_db_loss_reason ON public.lead_db (loss_reason) WHERE loss_reason IS NOT NULL;
