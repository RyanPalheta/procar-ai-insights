

## Plano: Adicionar Contador de Leads nos Dropdowns dos Filtros Globais

### Objetivo
Mostrar a contagem de leads disponíveis para cada opção nos filtros globais, permitindo que o usuário visualize rapidamente a distribuição antes de selecionar um filtro.

**Exemplo visual:**
- `WhatsApp (145)` ao invés de apenas `WhatsApp`
- `Venda ganha (23)` ao invés de apenas `Venda ganha`
- `PT-BR (89)` ao invés de apenas `PT-BR`

### Implementação Técnica

#### 1. Modificar Extração de Valores Únicos para Incluir Contagens

Atualmente, os valores únicos são extraídos como arrays simples. Precisamos transformá-los em arrays de objetos com `value` e `count`:

```typescript
// ANTES: Array simples
const uniqueChannels = useMemo(() => {
  const channels = new Set<string>();
  leads?.forEach(lead => { ... });
  return Array.from(channels).sort();
}, [leads]);

// DEPOIS: Array de objetos com contagem
const uniqueChannelsWithCount = useMemo(() => {
  const channelCounts = new Map<string, number>();
  leads?.forEach(lead => {
    const channel = normalizeChannel(lead.channel);
    if (channel !== "N/A") {
      channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    }
  });
  return Array.from(channelCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count); // Ordenar por contagem (maior primeiro)
}, [leads]);
```

#### 2. Aplicar Mesma Lógica para Status e Língua

```typescript
const uniqueStatusesWithCount = useMemo(() => {
  const statusCounts = new Map<string, number>();
  leads?.forEach(lead => {
    const status = normalizeStatus(lead.sales_status);
    if (status) {
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }
  });
  return Array.from(statusCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}, [leads]);

const uniqueLanguagesWithCount = useMemo(() => {
  const languageCounts = new Map<string, number>();
  leads?.forEach(lead => {
    if (lead.lead_language && !["N/A", "NDA"].includes(lead.lead_language)) {
      languageCounts.set(lead.lead_language, (languageCounts.get(lead.lead_language) || 0) + 1);
    }
  });
  return Array.from(languageCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}, [leads]);
```

#### 3. Atualizar UI dos Dropdowns

```tsx
{/* Channel Filter */}
<Select value={channelFilter} onValueChange={setChannelFilter}>
  <SelectTrigger className="w-[180px] bg-background">
    <SelectValue placeholder="Canal" />
  </SelectTrigger>
  <SelectContent className="bg-popover z-50">
    <SelectItem value="all">Todos os Canais ({leads?.length || 0})</SelectItem>
    {uniqueChannelsWithCount.map(({ value, count }) => (
      <SelectItem key={value} value={value}>
        {value} ({count})
      </SelectItem>
    ))}
  </SelectContent>
</Select>

{/* Status Filter */}
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectTrigger className="w-[260px] bg-background">
    <SelectValue placeholder="Status" />
  </SelectTrigger>
  <SelectContent className="bg-popover z-50">
    <SelectItem value="all">Todos os Status ({leads?.length || 0})</SelectItem>
    {uniqueStatusesWithCount.map(({ value, count }) => (
      <SelectItem key={value} value={value}>
        {value} ({count})
      </SelectItem>
    ))}
  </SelectContent>
</Select>

{/* Language Filter */}
<Select value={languageFilter} onValueChange={setLanguageFilter}>
  <SelectTrigger className="w-[160px] bg-background">
    <SelectValue placeholder="Língua" />
  </SelectTrigger>
  <SelectContent className="bg-popover z-50">
    <SelectItem value="all">Todas as Línguas ({leads?.length || 0})</SelectItem>
    {uniqueLanguagesWithCount.map(({ value, count }) => (
      <SelectItem key={value} value={value}>
        {value} ({count})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Considerações de UX

| Aspecto | Decisão |
|---------|---------|
| **Ordenação** | Por contagem (maior para menor) para destacar opções mais relevantes |
| **Formato** | `Nome (123)` - formato simples e legível |
| **Total na opção "Todos"** | Mostra total de leads para contexto |
| **Largura dos triggers** | Aumentar levemente para acomodar números (160px -> 180px para Canal, etc.) |

### Arquivo a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Leads.tsx` | Modificar `uniqueChannels`, `uniqueStatuses`, `uniqueLanguages` para incluir contagens; Atualizar UI dos Select components |

### Resultado Esperado

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔽 Filtrar por:                                                     │
│                                                                      │
│  Canal ▼              Status ▼                    Língua ▼          │
│  ┌──────────────────┐ ┌─────────────────────────┐ ┌───────────────┐ │
│  │ Todos (287)      │ │ Todos os Status (287)   │ │ Todas (287)   │ │
│  │ WhatsApp (145)   │ │ Aguardando (89)         │ │ PT-BR (145)   │ │
│  │ Facebook (98)    │ │ Em atendimento (67)     │ │ EN-USA (98)   │ │
│  │ Instagram (44)   │ │ Venda ganha (45)        │ │ ES-ES (44)    │ │
│  └──────────────────┘ │ Venda perdida (32)      │ └───────────────┘ │
│                       │ Proposta (54)           │                   │
│                       └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

