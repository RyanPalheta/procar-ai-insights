
# Plano: Migração de Métricas e Gráficos para o Dashboard

## Resumo da Mudança

Mover **todos os KPIs, gráficos e métricas** da página de Leads para o Dashboard, mantendo apenas a **tabela de leads** na aba de Leads.

---

## Estado Atual

### Dashboard (antes)
- 2 KPIs simples (Leads Processados, Score Médio)
- 4 gráficos básicos (Canal, Produtos, Sentimento, Temperatura, Timeline)
- Sem filtros globais
- Sem comparações de período

### Leads (antes)
- 6 KPIs avançados com comparações de período
- 8 gráficos completos
- Filtros globais (Canal, Status, Idioma)
- Seletor de período
- Feed de objeções e necessidades
- Tabela de leads com filtros

---

## Estado Final

### Dashboard (depois) - Completo
Terá **todos** os elementos analíticos:
- Filtros globais no topo
- 6 KPIs com comparações de período
- Gráfico de timeline com seletor de período
- 8 gráficos de distribuição
- Feed de objeções recentes
- Feed de necessidades recentes

### Leads (depois) - Apenas Tabela
Terá **somente** a tabela:
- Header com título
- Filtros de tabela (busca, status processado, datas, produto, sentimento, temperatura)
- Tabela de leads com ações

---

## Organização UI/UX do Dashboard

Layout organizado por hierarquia visual (mais importante primeiro):

```text
┌─────────────────────────────────────────────────────┐
│  Header: "Visão Geral" + Descrição                  │
├─────────────────────────────────────────────────────┤
│  [Filtros Globais] Canal | Status | Idioma | Limpar │
├─────────────────────────────────────────────────────┤
│  [6 KPIs] em grid 3x2                               │
│  Conversão | Score | Novos 24h                      │
│  Cotação | Valor Médio | Tempo Resposta             │
├─────────────────────────────────────────────────────┤
│  [Timeline] - Gráfico de linha (largura total)      │
├─────────────────────────────────────────────────────┤
│  [Gráficos Primários] 3 colunas                     │
│  Canal | Status | Temperatura                       │
├─────────────────────────────────────────────────────┤
│  [Gráficos Secundários] 3 colunas                   │
│  Idioma | Sentimento | Top Produtos                 │
├─────────────────────────────────────────────────────┤
│  [Gráficos Operacionais] 2 colunas                  │
│  Objeções | Compliance                              │
├─────────────────────────────────────────────────────┤
│  [Feeds] 2 colunas lado a lado                      │
│  Objeções Recentes | Necessidades Recentes          │
└─────────────────────────────────────────────────────┘
```

---

## Alterações Técnicas

### 1. Dashboard.tsx - Reescrever Completamente

**Adicionar imports:**
- Todos os componentes de chart de `@/components/leads/*`
- Hooks: `useState`, `useMemo`
- date-fns functions
- Icons necessários
- Componentes UI (Select, Button, Card, etc.)

**Adicionar states:**
```typescript
// Filtros globais
const [channelFilter, setChannelFilter] = useState("all");
const [statusFilter, setStatusFilter] = useState("all");
const [languageFilter, setLanguageFilter] = useState("all");

// Controles de período
const [scorePeriod, setScorePeriod] = useState("7");
const [timelinePeriod, setTimelinePeriod] = useState("30");
const [channelMode, setChannelMode] = useState("all");
```

**Adicionar queries:**
- Query de KPIs via RPC (`get_leads_kpis`)
- Query de interaction counts

**Adicionar lógica:**
- Funções de normalização (channel, status, sentiment)
- useMemo para filtros globais com contagem
- useMemo para `globalFilteredLeads`
- useMemo para `chartData` (todos os 8 charts)
- useMemo para `kpiMetrics`
- useMemo para feeds (objeções, necessidades)

### 2. Leads.tsx - Simplificar Drasticamente

**Remover:**
- Imports dos componentes de chart
- States de filtros globais e períodos
- Queries de KPIs via RPC
- Todos os useMemo de chartData, kpiMetrics, feeds
- Funções de normalização (já não serão usadas)
- JSX dos KPIs, charts e feeds

**Manter:**
- Query básica de leads
- Query de interaction counts
- States de filtros da tabela (search, processed, product, sentiment, temperature, dates)
- Lógica de filtro da tabela (`filteredLeads`)
- Funções auxiliares da tabela (getTemperatureDisplay, getStatusColor, etc.)
- Lógica de análise de lead
- JSX da tabela completa

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | **REESCREVER** - Adicionar toda a lógica e UI de métricas |
| `src/pages/Leads.tsx` | **SIMPLIFICAR** - Remover métricas, manter apenas tabela |

---

## Compatibilidade Verificada

- Todos os componentes de chart já existem em `src/components/leads/`
- O componente `LeadsKPICards` é independente e portável
- As queries RPC já existem no banco (`get_leads_kpis`)
- Nenhuma alteração em componentes filhos necessária
- Filtros globais podem ser removidos de Leads sem quebrar a tabela

---

## Considerações Adicionais

1. **Performance**: Dashboard terá mais queries, mas são as mesmas que já rodavam na Leads
2. **Links**: Os cards de objeções/necessidades linkam para `/leads/:id` - funcionarão normalmente
3. **Responsividade**: Manter grid responsivo com breakpoints existentes
4. **Consistência**: Usar mesmos estilos e cores já definidos

---

## Resultado Esperado

- **Dashboard**: Central de análise completa com todas as métricas de negócio
- **Leads**: Tela operacional focada em gestão individual de leads
- **Navegação natural**: Usuário analisa métricas no Dashboard → clica em lead → vai para Leads ou detalhes
