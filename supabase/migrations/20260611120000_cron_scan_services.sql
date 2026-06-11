-- 2026-06-11 (2ª auditoria, item 13): o gráfico "Inteligência de Produtos" zerou
-- porque services_detected parou de ser populado em 07/04 — o scan-services
-- (detecção por palavra-chave, custo zero de LLM) nunca teve agendamento e só
-- rodava à mão. Resultado: produtos apareciam apenas como upsell (leads=0, 0.0%).
-- Agenda o scan diário sobre os leads ainda sem services_detected. Um batch de
-- 200/dia cobre com folga o fluxo (~100 leads/dia); o backfill do estoque antigo
-- foi rodado manualmente em 11/06.

DO $unsched$
BEGIN
  BEGIN PERFORM cron.unschedule('scan-services-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END
$unsched$;

SELECT cron.schedule('scan-services-daily', '55 7 * * *', $job$
  SELECT net.http_post(
    url := 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/scan-services',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dash_anon_key')
    ),
    body := jsonb_build_object(
      'batch_size', 200,
      'only_unscanned', true,
      'trigger_kommo_sync', false
    )
  );
$job$);
