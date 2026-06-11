-- 2026-06-11 (2ª auditoria, itens 8/10 + Nota Média 0.0 do Painel 360):
-- CAUSA RAIZ do compliance/nota mortos desde ~04/05: a versão "stage-aware" do
-- analyze-lead seleciona playbooks.stage_requirements, mas a coluna NUNCA foi
-- criada (nenhuma migration no repo a define) -> todo fetch de playbook falhava
-- com 42703 -> playbook=null -> playbook_compliance_score e service_rating nulos
-- em TODAS as análises. Com a coluna criada (vazia), o fluxo volta: sem mapa de
-- estágios o código usa o fallback legado (score absoluto do modelo), e o mapa
-- pode ser preenchido por playbook quando a Pro Car subir os scripts novos.

ALTER TABLE public.playbooks ADD COLUMN IF NOT EXISTS stage_requirements jsonb;
