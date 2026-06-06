-- 2026-06-06: mede o gap Kommo × lead_db 1x/dia e grava um snapshot, para o card
-- "Saúde da base" acompanhar a convergência ao longo do tempo. Chama reconcile-kommo
-- (que agora persiste o resultado quando recebe body vazio = janela móvel de 30d) via
-- pg_cron + pg_net, autenticando com a anon key do Vault (segredo 'dash_anon_key', já
-- setado — mesmo padrão dos demais crons). Às 06:50 UTC.

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('reconcile-kommo-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('reconcile-kommo-daily', '50 6 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/reconcile-kommo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object()
  );
$job$);
