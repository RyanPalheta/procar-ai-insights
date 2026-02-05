

# Plano: Métrica de Correlação entre Conversão e Cotação

## Objetivo
Criar uma visualização que mostre como a presença e o valor das cotações impactam na taxa de conversão dos leads, permitindo identificar:
- Se leads com cotação convertem mais que leads sem cotação
- Quais faixas de preço têm melhor taxa de conversão
- O "sweet spot" de preço para maximizar vendas

---

## Abordagem Proposta

Criar um **gráfico de barras duplo** que mostra:

```text
Taxa de Conversão por Faixa de Cotação

100% |
 80% |  ████
 60% |  ████  ████
 40% |  ████  ████  ████  ████
 20% |  ████  ████  ████  ████  ████
  0% |────────────────────────────────
     Sem     R$0-    R$500-  R$1000- R$2000+
     Cotação 500     1000    2000
```

---

## Implementação

### 1. Nova RPC no Banco de Dados

Criar função `get_conversion_by_quote_bracket` que:
- Agrupa leads por presença/ausência de cotação e faixas de valor
- Calcula taxa de conversão em cada faixa
- Retorna dados ordenados por faixa

```sql
CREATE OR REPLACE FUNCTION get_conversion_by_quote_bracket(period_days integer DEFAULT NULL)
RETURNS TABLE(
  quote_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric,
  avg_quote_value numeric
)
```

### 2. Novo Componente de Gráfico

**Arquivo:** `src/components/leads/LeadsConversionByQuoteChart.tsx`

- Gráfico de barras com Recharts
- Cada barra mostra:
  - Faixa de cotação (label)
  - Taxa de conversão (altura)
  - Total de leads e valor médio na faixa (tooltip)
- Cores indicando performance:
  - Verde: taxa > média geral
  - Amarelo: taxa próxima da média
  - Vermelho: taxa < média geral

### 3. Card de Insight

Além do gráfico, um card destacando:
- Comparação entre leads COM vs SEM cotação
- A faixa de preço com MELHOR taxa de conversão
- Recomendação (ex: "Leads com cotação convertem 3.2x mais que leads sem cotação")

---

## Layout no Dashboard

O componente será adicionado na seção de gráficos operacionais, ao lado do gráfico de conversão por tempo de resposta:

```text
┌───────────────────────────────────────────────────────────────────┐
│  Conversão por Tempo de Resposta  │  Conversão por Cotação       │
│  ┌────────────────────────────┐   │  ┌────────────────────────┐  │
│  │  [0-15m] [15-30m] [30-60m] │   │  │  [Sem] [0-500] [500+]  │  │
│  └────────────────────────────┘   │  └────────────────────────┘  │
│                                                                   │
│  Insight: Leads com cotação entre R$500-1000                     │
│  convertem 45% mais que leads sem cotação apresentada            │
└───────────────────────────────────────────────────────────────────┘
```

---

## Dados Utilizados

| Fonte | Dados |
|-------|-------|
| `lead_db.lead_price` | Valor da cotação apresentada (null = sem cotação) |
| `lead_db.sales_status` | Status de conversão (ganha/won/agendamento confirmado) |
| `lead_db.last_ai_update` | Filtrar apenas leads auditados |

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova RPC `get_conversion_by_quote_bracket` |
| `src/components/leads/LeadsConversionByQuoteChart.tsx` | Novo componente |
| `src/pages/Dashboard.tsx` | Integrar novo gráfico |

---

## Seção Técnica

### Lógica da RPC

```sql
CREATE OR REPLACE FUNCTION get_conversion_by_quote_bracket(period_days integer DEFAULT NULL)
RETURNS TABLE(
  quote_bracket text,
  total_leads bigint,
  converted_leads bigint,
  conversion_rate numeric,
  avg_quote_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  period_start TIMESTAMP;
BEGIN
  IF period_days IS NOT NULL THEN
    period_start := NOW() - (period_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH bracketed AS (
    SELECT 
      CASE 
        WHEN lead_price IS NULL OR lead_price = 0 THEN 'Sem Cotação'
        WHEN lead_price <= 500 THEN 'R$ 0-500'
        WHEN lead_price <= 1000 THEN 'R$ 500-1000'
        WHEN lead_price <= 2000 THEN 'R$ 1000-2000'
        ELSE 'R$ 2000+'
      END as bracket,
      lead_price,
      sales_status
    FROM lead_db
    WHERE last_ai_update IS NOT NULL
    AND (period_days IS NULL OR created_at >= period_start)
  )
  SELECT 
    b.bracket as quote_bracket,
    COUNT(*)::bigint as total_leads,
    COUNT(*) FILTER (
      WHERE LOWER(b.sales_status) LIKE '%ganha%' 
         OR LOWER(b.sales_status) LIKE '%won%' 
         OR LOWER(b.sales_status) LIKE '%agendamento confirmado%'
    )::bigint as converted_leads,
    ROUND(
      COUNT(*) FILTER (
        WHERE LOWER(b.sales_status) LIKE '%ganha%' 
           OR LOWER(b.sales_status) LIKE '%won%' 
           OR LOWER(b.sales_status) LIKE '%agendamento confirmado%'
      ) * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate,
    ROUND(AVG(b.lead_price)::numeric, 2) as avg_quote_value
  FROM bracketed b
  GROUP BY b.bracket
  ORDER BY 
    CASE b.bracket 
      WHEN 'Sem Cotação' THEN 1 
      WHEN 'R$ 0-500' THEN 2 
      WHEN 'R$ 500-1000' THEN 3 
      WHEN 'R$ 1000-2000' THEN 4 
      ELSE 5 
    END;
END;
$$;
```

### Componente React

```tsx
// LeadsConversionByQuoteChart.tsx
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
  return "hsl(0, 72%, 51%)"; // vermelho
};

// Tooltip personalizado mostrando valor médio da cotação
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg">
      <p className="font-medium">{d.quote_bracket}</p>
      <p className="text-muted-foreground text-xs">
        {d.converted_leads} convertidos de {d.total_leads} leads
      </p>
      {d.avg_quote_value > 0 && (
        <p className="text-xs">Valor médio: R$ {d.avg_quote_value.toLocaleString('pt-BR')}</p>
      )}
      <p className="font-semibold mt-1">Taxa: {d.conversion_rate?.toFixed(1)}%</p>
    </div>
  );
};
```

### Insight Automático

O componente calculará automaticamente:
1. **Com vs Sem Cotação**: Diferença de conversão entre leads que receberam cotação vs os que não receberam
2. **Melhor Faixa de Preço**: Qual bracket de preço tem a melhor taxa de conversão
3. **Multiplicador**: Quantas vezes melhor é a melhor faixa vs a pior

---

## Valor de Negócio

Esta métrica permite:
1. **Validar a importância** de apresentar cotações no processo de vendas
2. **Identificar pricing ótimo** para maximizar conversões
3. **Orientar estratégia de precificação** baseada em dados reais
4. **Medir eficiência** da equipe em apresentar cotações

