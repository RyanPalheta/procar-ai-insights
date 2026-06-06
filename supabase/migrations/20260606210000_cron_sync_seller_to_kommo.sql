-- 2026-06-06: mantém a ATRIBUIÇÃO DE VENDEDOR viva (keystone) automaticamente.
-- Roda sync-seller-to-kommo 1x/dia (janela curta de 3 dias = novos agendamentos),
-- que faz a ponte ShopMonkey->telefone->Kommo CF e propaga pro lead_db. Auth pela
-- anon key no Vault (segredo 'dash_anon_key', já setado). pg_cron/pg_net já habilitados.
-- Roda às 06:40 UTC, depois do sync-shopmonkey horário (que já preencheu os agendamentos).

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('sync-seller-to-kommo-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('sync-seller-to-kommo-daily', '40 6 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/sync-seller-to-kommo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('days', 3)
  );
$job$);
