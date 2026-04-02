

# Plano: Auditoria Fria com KPIs + Execução no Final do Dia

## Resumo

Criar um sistema de auditoria fria que roda 1x por dia (23h), analisa leads sem interação há 24h (apenas 1 vez por lead), e armazena resultados estruturados que alimentam novos KPIs no dashboard.

## 1. Migração: Novos campos na `lead_db`

Adicionar campos para armazenar os resultados da auditoria fria:

```sql
ALTER TABLE lead_db ADD COLUMN cold_audit_reason TEXT;        -- Por que esfriou
ALTER TABLE lead_db ADD COLUMN cold_audit_followup_ok BOOLEAN; -- Follow-up adequado?
ALTER TABLE lead_db ADD COLUMN cold_audit_reactivation_chance TEXT; -- alta/media/baixa/nenhuma
ALTER TABLE lead_db ADD COLUMN cold_audit_suggestion TEXT;      -- Sugestão de ação
ALTER TABLE lead_db ADD COLUMN cold_audit_at TIMESTAMPTZ;       -- Quando foi auditado
ALTER TABLE lead_db ADD COLUMN last_interaction_at TIMESTAMPTZ; -- Última interação
```

## 2. Atualizar `ingest-interaction` 

Ao inserir nova interação, atualizar `last_interaction_at` no `lead_db` correspondente.

## 3. Edge Function: `audit-cold-leads`

- Busca leads onde:
  - `last_interaction_at < NOW() - INTERVAL '24 hours'`
  - `NOT ('auditoria_fria' = ANY(ai_tags))`  
  - `last_interaction_at IS NOT NULL`
- Para cada lead, chama a IA com prompt focado em:
  1. Por que o lead esfriou?
  2. O vendedor fez follow-up adequado? (boolean)
  3. Chance de reativação (alta/media/baixa/nenhuma)
  4. Sugestão de ação para recuperar
- Salva nos campos `cold_audit_*` e adiciona tag `auditoria_fria` ao `ai_tags`
- Processa em lotes com delay para evitar rate limiting

## 4. Agendar com `pg_cron` (23h diário)

```sql
SELECT cron.schedule('audit-cold-leads-daily', '0 23 * * *', $$
  SELECT net.http_post(url:='...', ...)
$$);
```

## 5. KPIs de Auditoria Fria no Dashboard de Leads

Adicionar uma seção de KPIs na página de Leads (abaixo dos KPIs existentes ou em nova aba):

| KPI | Fonte | Cálculo |
|-----|-------|---------|
| **Leads Frios** | `cold_audit_at IS NOT NULL` | Contagem total |
| **Sem Follow-up** | `cold_audit_followup_ok = false` | Contagem + % do total frio |
| **Reativáveis** | `cold_audit_reactivation_chance IN ('alta','media')` | Contagem |
| **Taxa Follow-up Adequado** | `cold_audit_followup_ok = true` | % dos leads frios |

Cada KPI será um card clicável que filtra a tabela de leads.

## 6. Filtros na página de Leads

Adicionar filtros:
- **Auditoria**: Todas / Normal / Fria
- **Chance de Reativação**: Todas / Alta / Média / Baixa / Nenhuma
- **Follow-up**: Todos / Adequado / Inadequado

## 7. Nova função DB `get_cold_audit_kpis`

Função SQL que retorna os KPIs agregados da auditoria fria com suporte a período, seguindo o padrão de `get_leads_kpis`.

## Detalhes Técnicos

```text
Fluxo diário:
pg_cron (23h) → audit-cold-leads
  → Query: leads sem interação 24h+ E sem tag 'auditoria_fria'
  → Para cada lead:
     → Busca interações + dados do lead
     → Prompt IA focado em diagnóstico frio
     → Salva cold_audit_* fields
     → Adiciona 'auditoria_fria' ao ai_tags
  → Log em audit_logs
```

- A tag `auditoria_fria` garante que cada lead só recebe 1 auditoria fria
- `last_interaction_at` é mantido automaticamente pelo `ingest-interaction`
- Os KPIs usam os campos `cold_audit_*` diretamente, sem necessidade de reprocessar

