-- 2026-06-05: Converte os valores de upsell já estimados de BRL para USD.
--
-- Contexto: historicamente a function `analyze-lead` instruía o modelo a estimar
-- o valor de upsell "em R$" (Reais). A Pro Car opera nos EUA (USD), então os
-- valores gravados em lead_db.upsell_value_estimate ficaram inflados pela cotação
-- BRL/USD (~5x), fazendo o KPI "Valor Potencial Upsell" aparecer ~5x maior
-- (ex.: >US$ 1 milhão quando o esperado é ~US$ 200 mil).
--
-- Esta migration faz uma correção ÚNICA dividindo as estimativas já existentes
-- pelo fator de câmbio, aproximando-as para USD. Leads novos passam a ser
-- estimados diretamente em USD após a mudança de prompt enviada junto desta migration.
--
-- ATENÇÃO: migration de DADOS, de execução ÚNICA e NÃO idempotente — rodar de
-- novo dividiria os valores outra vez. O Supabase aplica cada arquivo de migration
-- exatamente uma vez; não execute este UPDATE manualmente após aplicado.

DO $$
DECLARE
  -- Cotação aproximada BRL -> USD. 1.000.000 / 200.000 = 5 (estimativa do cliente).
  -- Ajuste aqui se você reconciliar contra um total conhecido.
  fx_factor NUMERIC := 5.0;
  affected  INTEGER;
BEGIN
  UPDATE lead_db
  SET upsell_value_estimate = ROUND((upsell_value_estimate / fx_factor)::numeric, 2)
  WHERE upsell_value_estimate IS NOT NULL
    AND upsell_value_estimate > 0;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'upsell_value_estimate: % linhas convertidas de BRL para USD (fator %)', affected, fx_factor;
END $$;
