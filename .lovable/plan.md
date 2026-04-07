

# Plano: Adicionar KPIs de Upsell no Dashboard "Visão Geral"

## Contexto

A função SQL `get_leads_kpis` já retorna `upsell_leads`, `upsell_leads_previous`, `upsell_total_value` e `upsell_total_value_previous`. Porém, o `Dashboard.tsx` não consome esses campos e o `LeadsKPICards` não tem props para eles.

## Mudanças

### 1. Atualizar `LeadsKPICards` — adicionar props de upsell

- Adicionar props: `upsellLeads`, `upsellLeadsVariation`, `upsellTotalValue`, `upsellTotalValueVariation`
- Adicionar 2 novos KPI cards na grid: **Oportunidades de Upsell** (contagem) e **Valor Potencial Upsell** (R$)
- Ajustar grid de 7 para 9 colunas no `xl` breakpoint
- Adicionar tooltips seguindo o padrão existente
- Ícones: `PackagePlus` para oportunidades, `BadgeDollarSign` para valor

### 2. Atualizar `Dashboard.tsx` — consumir dados de upsell

- Expandir o type cast do `kpisData` para incluir os 4 campos de upsell
- Calcular variações de upsell no `kpiMetrics` (mesmo padrão das outras variações)
- No modo filtro ativo (client-side), calcular upsell a partir de `globalFilteredLeads` usando `has_upsell` e `upsell_value_estimate`
- Passar as novas props para `LeadsKPICards`

### Detalhes Técnicos

- Nenhuma migração necessária — os campos já existem no DB e na função SQL
- A grid passa de `xl:grid-cols-7` para `xl:grid-cols-9` para acomodar os 2 novos cards
- Em telas menores, mantém o layout responsivo existente (2 cols mobile, 3 cols sm, 4 cols md)

