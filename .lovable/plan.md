
# Adicionar KPI "Leads Presenciais (Walking)" no Painel Principal

## Resumo
Adicionar um novo card de KPI no Dashboard principal mostrando a quantidade de leads presenciais (is_walking = true), com variacao percentual em relacao ao periodo anterior.

## Alteracoes

### 1. RPC `get_leads_kpis` (migracaco SQL)
Adicionar dois novos campos ao retorno da funcao:
- `walking_leads`: contagem de leads com `is_walking = true` no periodo atual
- `walking_leads_previous`: contagem no periodo anterior (para calcular variacao)

### 2. Dashboard (`src/pages/Dashboard.tsx`)
- Incluir `walking_leads` e `walking_leads_previous` no tipo de retorno da query RPC
- Calcular `walkingLeadsVariation` seguindo o mesmo padrao dos outros KPIs
- Passar `walkingLeads` e `walkingLeadsVariation` como props para `LeadsKPICards`
- No bloco de filtros globais ativos, calcular client-side a contagem de leads walking filtrados

### 3. LeadsKPICards (`src/components/leads/LeadsKPICards.tsx`)
- Adicionar props `walkingLeads` e `walkingLeadsVariation`
- Adicionar um novo `KPICard` com icone `Footprints` (ou similar do lucide), titulo "Leads Presenciais", variante visual baseada na quantidade
- Adicionar tooltip explicativo seguindo o padrao dos demais KPIs
- O grid passara de 6 para 7 cards (ou reorganizado em 2 linhas)

## Detalhes tecnicos

### Migracaco SQL
Adicionar ao `json_build_object` da funcao `get_leads_kpis`:
```sql
'walking_leads', (SELECT COUNT(*) FROM lead_db WHERE is_walking = true AND last_ai_update IS NOT NULL AND created_at >= period_start),
'walking_leads_previous', (SELECT COUNT(*) FROM lead_db WHERE is_walking = true AND last_ai_update IS NOT NULL AND created_at >= previous_period_start AND created_at < previous_period_end)
```

### Arquivos modificados
1. Migracao SQL - atualizar funcao `get_leads_kpis`
2. `src/pages/Dashboard.tsx` - tipos, calculo de variacao, passagem de props
3. `src/components/leads/LeadsKPICards.tsx` - novas props, novo KPI card
