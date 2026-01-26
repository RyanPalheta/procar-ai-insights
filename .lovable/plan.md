

## Plano: Filtros Principais Globais na Aba de Leads

### Objetivo
Adicionar três filtros principais visíveis no topo da página de Leads que filtram **todos os dados** (KPIs, gráficos e tabela) de acordo com:
1. **Canal** (WhatsApp, Facebook, Instagram)
2. **Status** (Status de vendas do CRM)
3. **Língua** (PT-BR, EN-USA, ES-ES)

### Posicionamento na UI

Os filtros serão colocados em uma barra destacada logo abaixo do título, antes dos KPIs:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Leads                                        [Período: 7 dias ▼]   │
├─────────────────────────────────────────────────────────────────────┤
│  🔽 Canal: Todos ▼    🔽 Status: Todos ▼    🔽 Língua: Todas ▼     │
├─────────────────────────────────────────────────────────────────────┤
│  [KPIs Cards] [KPIs Cards] [KPIs Cards] [KPIs Cards]                │
│  ─────────────────────────────────────────────────────────────      │
│  [Gráficos] [Gráficos] [Gráficos]                                   │
│  ─────────────────────────────────────────────────────────────      │
│  [Tabela de Leads]                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Dados Disponíveis no Banco

| Filtro | Valores Únicos |
|--------|----------------|
| **Canal** | WhatsApp, Facebook, Instagram |
| **Status** | Aguardando atendimento, Em atendimento (qualificação), Proposta/Negociação, Venda ganha, Venda perdida, etc. |
| **Língua** | PT-BR, EN-USA, ES-ES |

### Implementação Técnica

#### 1. Novos Estados para Filtros Globais

```typescript
// Novos estados para filtros principais
const [channelFilter, setChannelFilter] = useState<string>("all");
const [statusFilter, setStatusFilter] = useState<string>("all");
const [languageFilter, setLanguageFilter] = useState<string>("all");
```

#### 2. Extração de Valores Únicos

```typescript
// Canais únicos (normalizados)
const uniqueChannels = useMemo(() => {
  const channels = new Set<string>();
  leads?.forEach(lead => {
    const channel = normalizeChannel(lead.channel);
    if (channel !== "N/A") channels.add(channel);
  });
  return Array.from(channels).sort();
}, [leads]);

// Status únicos (normalizados)
const uniqueStatuses = useMemo(() => {
  const statuses = new Set<string>();
  leads?.forEach(lead => {
    const status = normalizeStatus(lead.sales_status);
    if (status) statuses.add(status);
  });
  return Array.from(statuses).sort();
}, [leads]);

// Idiomas únicos (excluindo NDA)
const uniqueLanguages = useMemo(() => {
  const languages = new Set<string>();
  leads?.forEach(lead => {
    if (lead.lead_language && !["N/A", "NDA"].includes(lead.lead_language)) {
      languages.add(lead.lead_language);
    }
  });
  return Array.from(languages).sort();
}, [leads]);
```

#### 3. Filtro Global Aplicado aos Leads

```typescript
// Leads filtrados pelos filtros GLOBAIS (afeta tudo: KPIs, gráficos, tabela)
const globalFilteredLeads = useMemo(() => {
  return leads?.filter(lead => {
    // Filtro por canal
    if (channelFilter !== "all") {
      const normalizedChannel = normalizeChannel(lead.channel);
      if (normalizedChannel !== channelFilter) return false;
    }
    
    // Filtro por status
    if (statusFilter !== "all") {
      const normalizedStatus = normalizeStatus(lead.sales_status);
      if (normalizedStatus !== statusFilter) return false;
    }
    
    // Filtro por língua
    if (languageFilter !== "all") {
      if (lead.lead_language !== languageFilter) return false;
    }
    
    return true;
  }) || [];
}, [leads, channelFilter, statusFilter, languageFilter]);
```

#### 4. Atualizar Cálculos de Charts e KPIs

Todos os cálculos que atualmente usam `leads` passarão a usar `globalFilteredLeads`:

```typescript
// Charts usarão globalFilteredLeads
const chartData = useMemo(() => {
  if (!globalFilteredLeads.length) return { ... };
  
  // Channel distribution
  const channelCounts = new Map<string, number>();
  globalFilteredLeads.forEach(l => { ... });
  
  // ... resto dos cálculos
}, [globalFilteredLeads, timelinePeriod]);
```

#### 5. Componente UI dos Filtros Globais

```tsx
{/* Barra de Filtros Globais */}
<Card className="mb-6">
  <CardContent className="py-4">
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="font-medium">Filtrar por:</span>
      </div>
      
      {/* Canal */}
      <Select value={channelFilter} onValueChange={setChannelFilter}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Canais</SelectItem>
          {uniqueChannels.map(channel => (
            <SelectItem key={channel} value={channel}>
              {channel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Status */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          {uniqueStatuses.map(status => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Língua */}
      <Select value={languageFilter} onValueChange={setLanguageFilter}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Língua" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Línguas</SelectItem>
          {uniqueLanguages.map(lang => (
            <SelectItem key={lang} value={lang}>
              {lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Botão Limpar */}
      {(channelFilter !== "all" || statusFilter !== "all" || languageFilter !== "all") && (
        <Button variant="ghost" size="sm" onClick={clearGlobalFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  </CardContent>
</Card>
```

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Leads.tsx` | Adicionar estados, extrair valores únicos, criar filtro global, atualizar UI |

### Fluxo de Dados Após Implementação

```
                     ┌─────────────────┐
                     │   leads (raw)   │
                     └────────┬────────┘
                              │
              ┌───────────────▼───────────────┐
              │   FILTROS GLOBAIS             │
              │   (Canal, Status, Língua)     │
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ globalFilteredLeads│
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌─────▼─────┐        ┌────▼────┐
    │  KPIs   │         │  Charts   │        │ Tabela  │
    │ (cards) │         │ (gráficos)│        │ + filtros│
    └─────────┘         └───────────┘        │secundários│
                                             └──────────┘
```

### Comportamento Esperado

1. **Ao selecionar "WhatsApp" no filtro Canal**:
   - KPIs mostram métricas apenas de leads do WhatsApp
   - Gráfico de Status mostra apenas status de leads do WhatsApp
   - Gráfico de Língua mostra distribuição de línguas do WhatsApp
   - Tabela exibe apenas leads do WhatsApp

2. **Ao combinar filtros**:
   - Exemplo: Canal = "WhatsApp" + Língua = "PT-BR"
   - Todos os dados refletem apenas leads que são WhatsApp E falam português

3. **Limpar filtros**:
   - Volta a exibir todos os dados

### Considerações Técnicas

- Os KPIs via RPC (`get_leads_kpis`) não serão afetados pelos filtros globais pois são calculados no servidor. Os KPIs locais calculados a partir de `globalFilteredLeads` serão atualizados.
- Os gráficos serão recalculados automaticamente via `useMemo` quando `globalFilteredLeads` mudar.
- Os dropdowns terão z-index alto e background sólido para evitar transparência.

