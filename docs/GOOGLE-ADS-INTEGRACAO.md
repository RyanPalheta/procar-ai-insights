# Integração Google Ads — arquitetura e operação

_Registro interno. Última atualização: 2026-06-25 (Fase 2)._

## 1. Visão geral / lineage

A aba **Google Ads** do dashboard é a **exceção** ao resto do painel: ela **não** lê o
Supabase Cloud `barssss`. Lê o **Supabase self-hosted da VPS**:

```
https://supabase.procarsoundsecuritytech.com/rest/v1
```

Fluxo fechado, sem passar pelo barssss:

```
Google Ads (conta 5937980298)
   └─ Google Ads Script (GAQL)  →  Supabase self-hosted (VPS)  →  dashboard (aba Google Ads)
      deploy/google-ads-to-supabase.gs                            src/hooks/useGoogleAdsData.ts
```

## 2. Tabelas (Postgres self-hosted, owner `supabase_admin`)

### `google_ads_metrics` — métricas por campanha/dia
Upsert em `UNIQUE (date, customer_id, campaign_id)`.

| coluna | nota |
|---|---|
| date, customer_id, campaign_id, campaign_name, campaign_status | `campaign_status` = ENABLED/PAUSED/REMOVED (maiúsculo via GAQL) |
| impressions, clicks, cost_micros | `cost_micros` é micros nativo (não multiplicar) |
| conversions, conversions_value | conversão **primária**. `conversions_value` ≈ 0 na conta (sem valor em $) |
| **all_conversions, all_conversions_value** | _(Fase 2)_ pega ligações/ações que a primária não conta |
| **search_impression_share** | _(Fase 2)_ 0..1, `null` para PMax/Display |
| **search_budget_lost_is, search_rank_lost_is** | _(Fase 2)_ perda de IS por verba / por lance |
| ctr, average_cpc_micros, roas | derivadas; o painel recalcula. `roas` não é mais usado |

### `google_ads_conversion_actions` — conversões por TIPO _(Fase 2)_
PK composta `(date, customer_id, campaign_id, conversion_action_name)`.
Colunas: date, customer_id, campaign_id, campaign_name, conversion_action_name,
conversion_category (ex.: `PHONE_CALL_LEAD`, `SUBMIT_LEAD_FORM`), conversions, conversions_value.

Ambas: RLS **on** + policies públicas (`Allow all read` / `insert` / `update`) +
grants para `anon`, `authenticated`, `service_role`.

## 3. Ingestão — `deploy/google-ads-to-supabase.gs`

Google Ads Script v2, **GAQL** (`AdsApp.search`). Duas coletas: `collectMetrics`
(impression share só combina com `segments.date`) e `collectConversionActions`
(segmenta por `segments.conversion_action_*`). Upsert via PostgREST com
`Prefer: resolution=merge-duplicates`. `DAYS_BACK = 30` cura buracos sem duplicar.

**Operação:**
- Preencher `SB_KEY` com o **service_role** (precisa para escrever).
- **AGENDAR** em Google Ads → Ferramentas → Scripts → Diariamente. _(Já ficou ~10 dias parado por falta de schedule — sintoma: dados congelam numa data.)_
- 1ª execução (Preview) faz backfill de 30 dias.

## 4. Dashboard

- **CPA** (custo por conversão = gasto ÷ conversões) no lugar do ROAS — ROAS era sempre 0 porque não há valor de conversão.
- **Campanhas Ativas**: comparação de status case-insensitive (`ENABLED`).
- **Parcela de Impressões (Search)**: `GoogleAdsImpressionShare.tsx` — apareceu / perdi por verba / perdi por lance, com veredito. IS agregada por **impressões elegíveis** (impr ÷ IS), não média simples.
- **Conversões por tipo**: `GoogleAdsConversionActions.tsx` — barras por ação, **ligações destacadas**.

## 5. Runbook — aplicar DDL no self-hosted

> Diferente do barssss (que é via Management API). Aqui é psql dentro do container.

```bash
ssh root@5.181.218.168
DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db')
docker exec -i "$DB" psql -U supabase_admin -d postgres -f - < arquivo.sql
```

- Usar **`-U supabase_admin`** (dono das tabelas e único superuser; `postgres` **não** é dono → erro `must be owner`).
- Terminar a DDL com `notify pgrst, 'reload schema';` para o PostgREST expor as mudanças no REST na hora.
- Deploy do front segue o runbook da VPS (`tar dist → scp → /opt/procar-dashboard/html`).

## 6. Próximos passos (Fase 2 — backlog)

Ainda não feitos (precisam de coluna/tabela + consulta no script + UI):
**termos de busca**, **geográfico por cidade** (negócio local), **device** (mobile/desktop),
nível de **ad group / anúncio**.
