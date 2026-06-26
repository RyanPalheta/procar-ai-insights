-- Rota B (Meta CAPI a partir do Supabase) — tabelas de apoio.
-- Aplicada em prod (barssss) via Management API em 2026-06-25; versionada aqui.
-- Escritas só por edge functions (service_role, bypassa RLS). RLS on, sem policy
-- pública = trancado (anon não lê/escreve).

-- 1) Log + dedup dos eventos enviados ao Meta (idempotência).
create table if not exists public.meta_capi_event (
  event_id         text primary key,        -- ex.: 'Purchase:<order_id>'
  event_name       text not null,           -- Purchase | Lead | Schedule
  source_id        text,                     -- order_id / appointment_id
  customer_id      text,
  phone_normalized text,
  value_cents      bigint,
  matched_ctwa     boolean default false,
  has_email        boolean default false,
  status           text,                     -- sent | error | skipped
  fb_trace_id      text,
  response         jsonb,
  created_at       timestamptz default now()
);
create index if not exists meta_capi_event_created_idx on public.meta_capi_event (created_at desc);
create index if not exists meta_capi_event_name_idx on public.meta_capi_event (event_name, created_at desc);
alter table public.meta_capi_event enable row level security;

-- 2) Ponte de atribuição: telefone -> click-id do anúncio (ctwa_clid / fbc / fbp).
--    phone_normalized = últimos 10 dígitos (mesmo padrão de shopmonkey_customer).
--    Alimentada da Data Table 'tracking' do n8n (uazapi) via meta-click-ingest + cron VPS.
create table if not exists public.meta_click (
  phone_normalized text primary key,
  ctwa_clid        text,
  fbc              text,
  fbp              text,
  source           text,                     -- ex.: whatsapp_ad
  campaign_id      text,
  captured_at      timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists meta_click_updated_idx on public.meta_click (updated_at desc);
alter table public.meta_click enable row level security;
