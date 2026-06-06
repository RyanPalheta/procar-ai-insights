-- 2026-06-06: mantém a contagem de avaliações do Google fresca automaticamente.
-- Roda sync-google-reviews 1x/dia (avaliações mudam devagar — diário basta) via
-- pg_cron + pg_net, autenticando com a anon key do Vault (segredo 'dash_anon_key',
-- já setado). Às 07:15 UTC. A function é idempotente (upsert por place_id+dia).
--
-- Enquanto GOOGLE_PLACES_API_KEY não estiver no ambiente das functions, o job dispara
-- mas a function responde 500 (sem gravar) — não quebra nada; o card fica no estado
-- "configure a key" até a primeira sincronização bem-sucedida.

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('sync-google-reviews-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('sync-google-reviews-daily', '15 7 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/sync-google-reviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object()
  );
$job$);
