
# Plano: Melhorias de UX/UI baseadas no Design de Referência

## Análise Comparativa

### Estado Atual vs Referência

| Elemento | Estado Atual | Referência |
|----------|--------------|------------|
| **KPI Cards** | Ícone pequeno no canto, badge de variação ao lado do valor | Ícone grande colorido, badge no canto superior direito |
| **Feeds de Objeções/Necessidades** | Cards simples com fundo uniforme | Cards com fundo colorido por categoria, tags coloridas |
| **Sidebar** | Seção única "Menu" | Múltiplas seções organizadas, badges de contagem, perfil |
| **Header** | Título + descrição simples | Busca global, notificações, botão exportar |
| **Período dos KPIs** | Select dropdown | Toggle buttons inline (7d, 30d, 90d, Todos) |

---

## Alterações Propostas

### 1. Novo Design dos KPI Cards

**Antes:**
```text
┌─────────────────────────┐
│ Título            [ícone]│
│ 25.4%  +6.0% ↑          │
│ Descrição                │
└─────────────────────────┘
```

**Depois:**
```text
┌─────────────────────────┐
│ [ícone]          [+6.0%]│
│  grande                  │
│ Título                   │
│ 25.4%                    │
└─────────────────────────┘
```

**Mudanças técnicas:**
- Ícone em quadrado arredondado com fundo colorido (40x40px)
- Badge de variação posicionado no canto superior direito
- Layout vertical: ícone → título → valor
- Cores de fundo do ícone baseadas no tipo de KPI

### 2. Novo Design dos Feeds (Objeções/Necessidades)

**Cores por categoria de objeção:**
```typescript
const objectionColors = {
  'preco': { bg: 'bg-red-50', border: 'border-red-200', tag: 'bg-red-100 text-red-700' },
  'tempo': { bg: 'bg-amber-50', border: 'border-amber-200', tag: 'bg-amber-100 text-amber-700' },
  'distancia': { bg: 'bg-yellow-50', border: 'border-yellow-200', tag: 'bg-yellow-100 text-yellow-700' },
  'concorrencia': { bg: 'bg-orange-50', border: 'border-orange-200', tag: 'bg-orange-100 text-orange-700' },
  'confianca': { bg: 'bg-blue-50', border: 'border-blue-200', tag: 'bg-blue-100 text-blue-700' },
};
```

**Cores por tipo de necessidade:**
```typescript
const needColors = {
  'urgente': { bg: 'bg-red-50', tag: 'bg-red-100 text-red-700' },
  'qualificado': { bg: 'bg-blue-50', tag: 'bg-blue-100 text-blue-700' },
  'alto_valor': { bg: 'bg-purple-50', tag: 'bg-purple-100 text-purple-700' },
  'recorrente': { bg: 'bg-cyan-50', tag: 'bg-cyan-100 text-cyan-700' },
  'expansao': { bg: 'bg-indigo-50', tag: 'bg-indigo-100 text-indigo-700' },
};
```

**Estrutura do card:**
```text
┌────────────────────────────────────────┐
│ [TAG COLORIDA]               2 min atrás│
│ Lead #4521 - Maria Santos              │
│ "O valor está acima do meu orçamento"  │
└────────────────────────────────────────┘
```

### 3. Sidebar Reestruturada

**Nova estrutura de seções:**
```text
PRINCIPAL
  ▸ Visão Geral (ativa)
  ▸ Leads [342]
  ▸ Conversas

ANÁLISES
  ▸ Performance

CONFIGURAÇÕES
  ▸ Configurações
  ▸ Ajuda

─────────────────
[Avatar] João Silva
        Administrador
```

**Mudanças:**
- Agrupar itens por categoria (Principal, Análises, Configurações)
- Badge de contagem no item "Leads"
- Footer com perfil do usuário (placeholder por enquanto)
- Renomear "Dashboard" para "Visão Geral"

### 4. Header do Dashboard Aprimorado

**Novo layout:**
```text
┌─────────────────────────────────────────────────────────────┐
│ Visão Geral                    [🔍 Buscar...] [🔔] [Exportar]│
│ Acompanhe suas métricas...                                   │
└─────────────────────────────────────────────────────────────┘
```

**Componentes:**
- Campo de busca global (decorativo por agora)
- Ícone de notificações com badge vermelho
- Botão "Exportar" azul

### 5. Toggle de Período dos KPIs

**Antes:** Select dropdown com "Últimos 7 dias"

**Depois:** Grupo de botões inline
```text
Indicadores Principais        [7 dias] [30 dias] [90 dias] [Todos]
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/dashboard/KPICard.tsx` | Redesign completo do layout do card |
| `src/components/leads/LeadsKPICards.tsx` | Trocar Select por ToggleGroup para período |
| `src/pages/Dashboard.tsx` | Novo header com busca/notificações, redesign dos feeds |
| `src/components/layout/AppSidebar.tsx` | Reestruturar em seções, adicionar badges e perfil |

---

## Considerações de Implementação

### Prioridade de Mudanças

1. **Alta Prioridade**: KPI Cards (maior impacto visual)
2. **Alta Prioridade**: Feeds de Objeções/Necessidades (melhora a usabilidade)
3. **Média Prioridade**: Toggle de período (melhor UX)
4. **Média Prioridade**: Sidebar (organização)
5. **Baixa Prioridade**: Header (decorativo por enquanto)

### Dependências

- Componente `ToggleGroup` do shadcn/ui já está instalado
- Cores semânticas já definidas no design system
- Nenhuma nova biblioteca necessária

### Compatibilidade

- Todas as mudanças são backward-compatible
- Props existentes dos componentes serão mantidas
- Dark mode será preservado (usar variantes dark: para cores)

---

## Resultado Visual Esperado

Após as alterações, o Dashboard terá:
- Visual mais limpo e moderno alinhado com padrões SaaS
- Hierarquia visual mais clara nos KPIs
- Feeds coloridos que facilitam identificação rápida de categorias
- Sidebar organizada por contexto de uso
- Período dos KPIs mais acessível com toggle buttons
