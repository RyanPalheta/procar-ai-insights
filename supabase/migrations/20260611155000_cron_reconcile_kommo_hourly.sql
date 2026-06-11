-- 2026-06-11 (2ª auditoria): o card "Leads Novos (24h)" descolava da Kommo ao longo
-- do dia porque o kommo_absent só era recalculado 1x/dia (reconcile-kommo-daily,
-- 06:50 UTC). Chat sem espelho na Kommo e leads mesclados/apagados lá entravam no
-- lead_db e ficavam contando até a madrugada seguinte.
--
-- Correção: reconcile HORÁRIO com janela curta (2 dias — cobre as últimas 24h com
-- folga), mark_missing ligado e snapshot DESLIGADO (o snapshot diário de 30d do
-- card "Saúde da base" continua exclusivo do reconcile-kommo-daily). Roda às :12,
-- logo depois do sync-kommo-hourly (:07), que insere os leads que faltam — assim a
-- janela móvel de 24h fica no máximo ~1h atrás da Kommo, nos dois sentidos.

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('reconcile-kommo-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('reconcile-kommo-hourly', '12 * * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/reconcile-kommo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object('window_days', 2, 'mark_missing', true, 'snapshot', false)
  );
$job$);
