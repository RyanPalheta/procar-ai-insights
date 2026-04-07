

# Plano: Upsell como KPI Estruturado no Dashboard

## Situação Atual

O campo `upsell_opportunity` já existe na `lead_db` e a IA já o preenche — mas é um **texto livre**, sem estrutura. Isso impede agregação e KPIs confiáveis.

## Mudanças Propostas

### 1. Novos campos estruturados na `lead_db`

```sql
ALTER TABLE lead_db ADD COLUMN has_upsell BOOLEAN DEFAULT false;
ALTER TABLE lead_db ADD COLUMN upsell_products TEXT[];  -- produtos sugeridos para upsell
ALTER TABLE lead_db ADD COLUMN upsell_value_estimate NUMERIC; -- valor estimado do upsell
```

- `has_upsell`: booleano simples para contagem rápida
- `upsell_products`: lista de produtos/serviços identificados como oportunidade
- `upsell_value_estimate`: valor estimado (opcional, preenchido quando possível)
- `upsell_opportunity` (existente): mantido como texto descritivo

### 2. Atualizar o prompt e tool schema do `analyze-lead`

Adicionar ao prompt:
- "Há oportunidade de upsell? (sim/não)"
- "Quais produtos/serviços adicionais o cliente poderia contratar?"
- "Qual o valor estimado desse upsell?"

Adicionar ao tool schema:
```json
has_upsell: { type: "boolean" },
upsell_products: { type: "array", items: { type: "string" } },
upsell_value_estimate: { type: "number", nullable: true }
```

### 3. Atualizar `get_leads_kpis` com métricas de upsell

Adicionar ao retorno da função SQL:

| KPI | Cálculo |
|-----|---------|
| **Leads com Upsell** | `COUNT(*) WHERE has_upsell = true` |
| **Taxa de Upsell** | `% de leads com upsell vs total auditado` |
| **Valor Total Upsell** | `SUM(upsell_value_estimate)` |

Com comparação de período anterior, seguindo o padrão existente.

### 4. Novo KPI card no dashboard de Leads

Adicionar 2 novos cards na seção de KPIs (`LeadsKPICards`):

- **Oportunidades de Upsell**: contagem de leads com `has_upsell = true` + variação
- **Valor Potencial Upsell**: soma de `upsell_value_estimate` formatada em R$

### 5. Filtro de upsell na página de Leads

Adicionar filtro: **Upsell**: Todos / Com Upsell / Sem Upsell

### 6. Corrigir build error

- `analyze-lead/index.ts` linha 630: adicionar type annotation `(err: Error)` no catch

## Detalhes Técnicos

```text
Fluxo:
ingest-lead → analyze-lead (prompt atualizado com upsell estruturado)
  → Extrai: has_upsell, upsell_products[], upsell_value_estimate
  → Salva via update-lead
  → get_leads_kpis agrega para KPIs
  → LeadsKPICards exibe no dashboard
```

- Os campos estruturados permitem agregação SQL direta
- O texto livre `upsell_opportunity` é mantido para detalhes na página do lead
- A grid de KPIs passa de 7 para 9 colunas (responsivo via grid classes)

