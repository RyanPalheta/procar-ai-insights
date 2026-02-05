
# Plano: Métrica de Correlação entre Conversão e Tempo de Atendimento

## Objetivo
Criar uma visualização que mostre como o tempo de primeira resposta impacta na taxa de conversão dos leads, permitindo identificar se atendimentos mais rápidos geram mais vendas.

---

## Abordagem Proposta

Criar um **gráfico de barras** que agrupa leads por faixas de tempo de resposta e mostra a taxa de conversão em cada faixa:

```text
Taxa de Conversão por Tempo de Resposta

100% |
 80% |  ████
 60% |  ████  ████
 40% |  ████  ████  ████
 20% |  ████  ████  ████  ████
  0% |──────────────────────────
      0-15m  15-30m 30-60m  60m+
```

---

## Implementação

### 1. Nova RPC no Banco de Dados

Criar função `get_conversion_by_response_time` que:
- Calcula o tempo de primeira resposta por lead (usando interaction_db)
- Agrupa em faixas: 0-15min, 15-30min, 30-60min, 60min+
- Calcula taxa de conversão em cada faixa

```sql
CREATE OR REPLACE FUNCTION get_conversion_by_response_time(period_days integer DEFAULT NULL)
RETURNS TABLE(
  time_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric
)
```

### 2. Novo Componente de Gráfico

**Arquivo:** `src/components/leads/LeadsConversionByResponseTimeChart.tsx`

- Gráfico de barras com Recharts
- Cada barra mostra:
  - Faixa de tempo (label)
  - Taxa de conversão (altura)
  - Total de leads na faixa (tooltip)
- Cores indicando performance:
  - Verde: taxa > média geral
  - Amarelo: taxa próxima da média
  - Vermelho: taxa < média geral

### 3. Card de Insight

Além do gráfico, um card destacando:
- A faixa de tempo com MELHOR taxa de conversão
- Diferença percentual vs a pior faixa
- Recomendação (ex: "Leads respondidos em até 15min convertem 2.3x mais")

---

## Layout no Dashboard

O componente será adicionado na seção de gráficos do Dashboard, ocupando metade da largura (ao lado de outro gráfico existente):

```text
┌────────────────────────────────────────────────────────┐
│  Conversão por Tempo de Resposta    │  Outro Gráfico  │
│  ┌──────────────────────────────┐   │                 │
│  │  Bar Chart                   │   │                 │
│  │  [0-15m] [15-30m] [30-60m]   │   │                 │
│  └──────────────────────────────┘   │                 │
│                                                        │
│  💡 Insight: Leads respondidos em até 15 min          │
│     convertem 45% mais que os respondidos após 1h     │
└────────────────────────────────────────────────────────┘
```

---

## Dados Utilizados

| Fonte | Dados |
|-------|-------|
| `interaction_db` | Timestamps das interações para calcular tempo de resposta |
| `lead_db.sales_status` | Status de conversão (ganha/won/agendamento confirmado) |
| `lead_db.last_ai_update` | Filtrar apenas leads auditados |

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova RPC `get_conversion_by_response_time` |
| `src/components/leads/LeadsConversionByResponseTimeChart.tsx` | Novo componente |
| `src/pages/Dashboard.tsx` | Integrar novo gráfico |

---

## Seção Técnica

### Lógica da RPC

```sql
-- Calcula tempo de resposta (entre 1ª e 3ª interação) por lead
-- Agrupa em faixas
-- Conta conversões em cada faixa

WITH response_times AS (
  SELECT 
    l.session_id,
    l.sales_status,
    -- Tempo entre 1ª e 3ª interação em minutos
    EXTRACT(EPOCH FROM (t3 - t1)) / 60 as response_minutes
  FROM lead_db l
  JOIN (
    -- Subquery para calcular t1 e t3 por session
  ) times ON l.session_id = times.session_id
  WHERE l.last_ai_update IS NOT NULL
),
bracketed AS (
  SELECT 
    CASE 
      WHEN response_minutes <= 15 THEN '0-15 min'
      WHEN response_minutes <= 30 THEN '15-30 min'
      WHEN response_minutes <= 60 THEN '30-60 min'
      ELSE '60+ min'
    END as time_bracket,
    sales_status
  FROM response_times
)
SELECT 
  time_bracket,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE sales_status ILIKE '%ganha%' OR sales_status ILIKE '%won%' OR sales_status ILIKE '%agendamento confirmado%') as converted_leads,
  ROUND(
    COUNT(*) FILTER (WHERE ...) * 100.0 / NULLIF(COUNT(*), 0),
    1
  ) as conversion_rate
FROM bracketed
GROUP BY time_bracket
ORDER BY time_bracket;
```

### Componente React

```tsx
// LeadsConversionByResponseTimeChart.tsx
const chartConfig = {
  conversionRate: {
    label: "Taxa de Conversão",
    color: "hsl(var(--primary))",
  },
};

// Cores dinâmicas baseadas na performance
const getBarColor = (rate: number, avgRate: number) => {
  if (rate > avgRate * 1.1) return "hsl(142, 76%, 36%)"; // verde
  if (rate > avgRate * 0.9) return "hsl(48, 96%, 53%)"; // amarelo
  return "hsl(0, 84%, 60%)"; // vermelho
};
```

---

## Valor de Negócio

Esta métrica permite:
1. **Quantificar o impacto** do tempo de resposta nas vendas
2. **Definir SLAs** baseados em dados reais
3. **Justificar investimentos** em automação/equipe
4. **Identificar gargalos** no processo de atendimento

