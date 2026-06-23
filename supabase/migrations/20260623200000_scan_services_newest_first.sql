-- 2026-06-23: a "Inteligência de Produtos" voltou a zerar (services_detected
-- vazio desde ~11/06). Causa: o cron scan-services varria a fila
-- (services_detected IS NULL) por session_id ASCENDENTE a partir de 0, sem
-- cursor persistido. O backfill Kommo de 06/06 colocou milhares de leads ANTIGOS
-- SEM chat no começo da fila; como esses não geram detecção, services_detected
-- ficava NULL e o MESMO lote de 200 era reprocessado todo dia — nunca chegando
-- nos leads de chat recentes (223 presos só nos últimos 7 dias).
--
-- Correções (a função scan-services também mudou neste PR):
--   1) varrer os MAIS RECENTES primeiro (newest_first) — recentes sempre frescos;
--   2) a função agora carimba [] quando nada é detectado, então o lead SAI da
--      fila IS NULL e o cursor avança (drena o backlog de cima para baixo);
--   3) keyword-first com fallback de IA (service_desired) dentro da função.

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
      'trigger_kommo_sync', false,
      'newest_first', true
    )
  );
$job$);
