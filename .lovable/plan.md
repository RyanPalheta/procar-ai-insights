

# Adicionar Filtro por Vendedor no Painel 360 e na aba de Leads

## Resumo
Adicionar um seletor de vendedor em ambas as telas (Painel 360 e Leads) para permitir visualizar metricas individuais por vendedor. Os vendedores serao extraidos dinamicamente do campo `sales_person_id` da tabela `lead_db`.

## Alteracoes

### 1. Painel 360 (`src/pages/TVDashboard.tsx`)
- Adicionar estado `selectedSeller` (default: `"all"`)
- Extrair lista unica de vendedores a partir dos leads carregados (excluindo nulos/vazios)
- Adicionar um seletor (Select/dropdown) ao lado do filtro de periodo no header
- Aplicar o filtro de vendedor nos `useMemo` de `filteredLeads` e `previousPeriodLeads`, filtrando por `sales_person_id`
- Passar o `selectedSeller` como parametro na query de KPIs via RPC (ou filtrar client-side, ja que os leads ja sao carregados)
- Como os KPIs de conversao e tempo de resposta vem da RPC `get_leads_kpis` (que nao suporta filtro por vendedor), esses KPIs continuarao globais. Os KPIs calculados client-side (compliance, saudacao, qualificacao, objecoes, nota media) serao filtrados por vendedor

### 2. Pagina de Leads (`src/pages/Leads.tsx`)
- Adicionar estado `sellerFilter` (default: `"all"`)
- Extrair lista unica de vendedores (`sales_person_id`) dos leads, similar aos outros filtros existentes
- Adicionar um Select no painel de filtros expandido, seguindo o mesmo padrao visual dos filtros existentes (canal, status, etc.)
- Aplicar filtro na logica de `filteredLeads`
- Incluir no contador de filtros ativos e na funcao `clearFilters`

## Detalhes tecnicos

### TVDashboard - Dropdown de vendedor
Sera um componente `Select` do Radix UI posicionado no header, ao lado do toggle de periodo. Mostrara "Todos" como opcao padrao e listara os vendedores encontrados nos dados.

### Leads - Filtro de vendedor
Sera adicionado ao painel de filtros expandido (dentro do bloco `showFilters`), como um `Select` com label "Vendedor", seguindo o padrao dos filtros de Canal e Status de Venda ja existentes.

### Filtragem
Em ambas as telas, a filtragem e feita client-side comparando `lead.sales_person_id === selectedSeller`. Como todos os leads ja sao carregados em memoria, nao ha necessidade de alterar queries no banco.

### Arquivos modificados
1. `src/pages/TVDashboard.tsx` - estado, extrator de vendedores, Select no header, filtro nos useMemo
2. `src/pages/Leads.tsx` - estado, extrator de vendedores, Select nos filtros, filtro no useMemo, clearFilters

