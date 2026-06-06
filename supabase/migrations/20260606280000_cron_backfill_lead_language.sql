-- 2026-06-06: mantém o idioma dos leads de chat fresco. Roda backfill-lead-language
-- 1x/dia (idioma não muda) via pg_cron + pg_net, autenticando com a anon key do Vault
-- (segredo 'dash_anon_key', já setado). Às 07:40 UTC. Idempotente: a function só
-- preenche quem está sem idioma (NULL/NDA) e tem mensagens; nunca sobrescreve.
-- O analyze-lead já grava o idioma dos leads auditados; este cron cobre o restante.

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('backfill-lead-language-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('backfill-lead-language-daily', '40 7 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/backfill-lead-language',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('max_batches', 6)
  );
$job$);
