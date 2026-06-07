-- 2026-06-07: Dedup chat <-> Kommo (Fase 2 / passo D do PLANO-DEDUP-TELEFONE.md).
-- NAO-DESTRUTIVO: MARCA, nao apaga. Apagar reverteria sozinho (sync-kommo e
-- insert-only por session_id) e quebraria os joins de interaction_db por session_id
-- (tempo de 1a resposta / conversao por tempo).
--
-- Criterio: marca como duplicata o ESPELHO 'kommo_sync' cujo telefone (phone_normalized)
-- bate com uma linha de CHAT (source_system <> 'kommo_sync') dentro de uma JANELA de tempo
-- (default 14 dias) — assim NAO colapsa recompra (mesma pessoa, oportunidades distintas no
-- tempo), so o espelho da MESMA oportunidade. O canonico e a linha de chat mais proxima.
--
-- EFEITO HOJE: ~zero, porque o chat ainda nao grava telefone (depende do n8n enviar
-- body.phone; o ingest-lead ja passa a aceita-lo). Fica pronto para quando os telefones
-- de chat existirem. Seguro de rodar: marca 0 enquanto so os espelhos Kommo tem telefone.

ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS canonical_session_id bigint;

CREATE OR REPLACE FUNCTION public.recompute_lead_duplicates(window_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  -- reset (idempotente — recomputavel a qualquer momento)
  UPDATE lead_db
     SET is_duplicate = false, canonical_session_id = NULL
   WHERE is_duplicate = true OR canonical_session_id IS NOT NULL;

  -- marca o espelho kommo_sync como duplicata da linha de chat mais proxima no tempo
  WITH pairs AS (
    SELECT k.session_id AS dup_id,
           c.session_id AS canon_id,
           ROW_NUMBER() OVER (
             PARTITION BY k.session_id
             ORDER BY abs(EXTRACT(EPOCH FROM (k.created_at - c.created_at)))
           ) AS rn
    FROM lead_db k
    JOIN lead_db c
      ON c.phone_normalized = k.phone_normalized
     AND c.phone_normalized IS NOT NULL
     AND c.source_system IS DISTINCT FROM 'kommo_sync'
     AND k.source_system = 'kommo_sync'
     AND abs(EXTRACT(EPOCH FROM (k.created_at - c.created_at))) <= window_days * 86400
  )
  UPDATE lead_db k
     SET is_duplicate = true, canonical_session_id = p.canon_id
    FROM pairs p
   WHERE k.session_id = p.dup_id AND p.rn = 1;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- VIEW deduplicada — passo E: leitores migram para ca quando o diagnostico validar.
-- security_invoker = respeita a RLS de quem consulta (lead_db).
CREATE OR REPLACE VIEW public.lead_db_dedup WITH (security_invoker = true) AS
  SELECT * FROM public.lead_db WHERE is_duplicate IS NOT TRUE;

GRANT SELECT ON public.lead_db_dedup TO anon, authenticated;

-- roda uma vez (marca ~0 hoje; seguro)
SELECT public.recompute_lead_duplicates(14);

-- cron diario p/ manter a marcacao conforme os telefones de chat forem chegando
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-lead-duplicates-daily') THEN
    PERFORM cron.unschedule('recompute-lead-duplicates-daily');
  END IF;
END $$;
SELECT cron.schedule('recompute-lead-duplicates-daily', '40 6 * * *',
  $$SELECT public.recompute_lead_duplicates(14);$$);
