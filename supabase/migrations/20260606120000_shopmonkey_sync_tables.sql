-- 2026-06-06: Tabelas dedicadas para os dados do ShopMonkey (fonte real de
-- agendamentos e vendas da loja), alimentadas pela edge function sync-shopmonkey.
--
-- Contexto (diagnóstico de confiabilidade): o lead_db do dashboard é alimentado
-- SÓ por chat (WhatsApp). Agendamentos e vendas reais vivem no ShopMonkey e hoje
-- não chegam ao BI — por isso "Vendas = 0" e a conversão parecem irreais. Estas
-- tabelas trazem esses dados, separando AGENDAMENTO de VENDA (pedido da auditoria).
--
-- Regras (verificadas no integration procar-shopmonkey-sync):
--   Agendamento = appointment com color = 'green'.
--   Venda       = order pago (pagamento Succeeded/Charge/não-estornado).
--                 receita = paid_cost_cents / 100 (USD).

CREATE TABLE IF NOT EXISTS public.shopmonkey_appointment (
  id              text PRIMARY KEY,        -- ShopMonkey appointment id
  start_date      timestamptz,
  end_date        timestamptz,
  color           text,                    -- 'green' = agendamento confirmado
  customer_id     text,
  order_id        text,
  created_date    timestamptz,             -- ShopMonkey createdDate
  synced_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_appt_start ON public.shopmonkey_appointment (start_date);
CREATE INDEX IF NOT EXISTS idx_sm_appt_color ON public.shopmonkey_appointment (color);

CREATE TABLE IF NOT EXISTS public.shopmonkey_sale (
  id                text PRIMARY KEY,      -- ShopMonkey order id
  fully_paid_date   timestamptz,
  paid_cost_cents   bigint,
  total_cost_cents  bigint,
  customer_id       text,
  invoiced          boolean,
  created_date      timestamptz,
  synced_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_sale_paid ON public.shopmonkey_sale (fully_paid_date);

-- RLS: o dashboard lê com a anon/auth key; a edge function escreve com a service
-- role (bypassa RLS). Leitura liberada para anon + authenticated (somente SELECT).
ALTER TABLE public.shopmonkey_appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopmonkey_sale ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_shopmonkey_appointment" ON public.shopmonkey_appointment;
CREATE POLICY "read_shopmonkey_appointment" ON public.shopmonkey_appointment
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_shopmonkey_sale" ON public.shopmonkey_sale;
CREATE POLICY "read_shopmonkey_sale" ON public.shopmonkey_sale
  FOR SELECT TO anon, authenticated USING (true);
