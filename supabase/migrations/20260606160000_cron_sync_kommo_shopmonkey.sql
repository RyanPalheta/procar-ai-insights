-- 2026-06-06: cron para manter o espelho Kommo/ShopMonkey fresco SEM n8n.
-- Roda sync-kommo e sync-shopmonkey de hora em hora via pg_cron + pg_net,
-- autenticando com a anon key guardada no Vault (segredo 'dash_anon_key', setado
-- FORA do git via Management API — NÃO commitar a chave). Janela curta (days=2) =
-- incremental, barato e idempotente (sync-kommo é insert-only; sync-shopmonkey é upsert).
--
-- Pré-requisito (one-off, já aplicado no projeto barssss):
--   select vault.create_secret('<ANON_KEY>', 'dash_anon_key');
-- Se rodar num projeto novo sem esse segredo, os jobs disparam mas recebem 401 até
-- o segredo existir (não quebra a migração).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- (re)agenda idempotente: remove jobs antigos de mesmo nome antes de recriar.
DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('sync-kommo-hourly');      EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('sync-shopmonkey-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('sync-kommo-hourly', '7 * * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/sync-kommo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('days', 2)
  );
$job$);

SELECT cron.schedule('sync-shopmonkey-hourly', '22 * * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/sync-shopmonkey',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('days', 2)
  );
$job$);
