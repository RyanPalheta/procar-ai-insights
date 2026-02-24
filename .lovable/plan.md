
# Filtro de Data no Dashboard Principal

## Objetivo
Adicionar um filtro de intervalo de datas (date range picker) com calendario na barra de filtros do Dashboard, permitindo filtrar todos os dados por periodo personalizado.

## Como vai funcionar
- Dois campos de data (Data Inicio e Data Fim) na barra de filtros existente, ao lado dos filtros de Canal, Status e Lingua
- Cada campo abre um calendario (Popover + Calendar) ao clicar
- Ao selecionar um intervalo, todos os leads exibidos no dashboard sao filtrados por `created_at`
- Presets rapidos: "Hoje", "7 dias", "30 dias", "90 dias" como botoes dentro do popover
- Botao "Limpar" ja existente tambem reseta o filtro de data

## Detalhes Tecnicos

### 1. Atualizar `src/components/ui/calendar.tsx`
- Adicionar `pointer-events-auto` na classe do DayPicker para garantir interatividade dentro do Popover

### 2. Criar componente `src/components/dashboard/DateRangeFilter.tsx`
- Componente reutilizavel com dois Popovers (Data Inicio / Data Fim)
- Usa os componentes existentes: `Popover`, `PopoverTrigger`, `PopoverContent`, `Calendar`, `Button`
- Formatacao de data em portugues usando `date-fns/locale/ptBR`
- Presets rapidos (Hoje, 7d, 30d, 90d) como botoes auxiliares
- Props: `dateFrom`, `dateTo`, `onDateFromChange`, `onDateToChange`

### 3. Atualizar `src/pages/Dashboard.tsx`
- Adicionar estados `dateFrom` e `dateTo` (tipo `Date | undefined`)
- Inserir o `DateRangeFilter` na barra de filtros (Card com borda tracejada, linha 628-698)
- Atualizar `globalFilteredLeads` para incluir filtragem por `created_at` entre as datas selecionadas
- Atualizar `hasActiveGlobalFilters` para considerar filtros de data
- Atualizar `clearGlobalFilters` para resetar as datas
