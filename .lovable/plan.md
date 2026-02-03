
# Plano: Gráfico de Distribuição de Compliance

## Objetivo
Criar um gráfico semi-circular (gauge chart) similar ao design fornecido que mostra a distribuição de compliance dos vendedores, com valor central mostrando a média geral e legenda detalhada por faixa.

## Design do Componente

### Visual
- **Gráfico gauge semi-circular** (180°) como no exemplo
- **Valor central**: Score médio de compliance (ex: "75%")
- **Subtítulo**: "Média de Compliance"
- **Legenda vertical** abaixo com 4 categorias:
  - 🟢 **Excelente (≥80%)**: X leads | Y%
  - 🟡 **Bom (60-79%)**: X leads | Y%
  - 🟠 **Regular (40-59%)**: X leads | Y%
  - 🔴 **Baixo (<40%)**: X leads | Y%

### Cores
```text
Excelente: #22c55e (green-500)
Bom: #eab308 (yellow-500)
Regular: #f97316 (orange-500)
Baixo: #ef4444 (red-500)
```

## Alterações Necessárias

### 1. Criar novo componente
**Arquivo**: `src/components/leads/LeadsComplianceChart.tsx`

```text
- Recebe dados de compliance dos leads filtrados
- Calcula distribuição por faixas
- Exibe gauge chart + legenda
- Mostra "Sem dados" quando não há leads auditados
```

### 2. Modificar Leads.tsx
**Alterações**:
1. Adicionar cálculo de `complianceData` no `chartData` useMemo
2. Importar e renderizar `LeadsComplianceChart` na grid de gráficos

## Dados Calculados

```typescript
// Dentro do chartData useMemo
const leadsWithCompliance = globalFilteredLeads.filter(
  l => l.playbook_compliance_score !== null
);

const complianceRanges = {
  excellent: leadsWithCompliance.filter(l => l.playbook_compliance_score >= 80).length,
  good: leadsWithCompliance.filter(l => l.playbook_compliance_score >= 60 && l.playbook_compliance_score < 80).length,
  regular: leadsWithCompliance.filter(l => l.playbook_compliance_score >= 40 && l.playbook_compliance_score < 60).length,
  low: leadsWithCompliance.filter(l => l.playbook_compliance_score < 40).length,
};

const avgCompliance = leadsWithCompliance.length > 0
  ? leadsWithCompliance.reduce((sum, l) => sum + l.playbook_compliance_score, 0) / leadsWithCompliance.length
  : 0;
```

## Estrutura do Componente

```typescript
interface LeadsComplianceChartProps {
  data: {
    name: string;  // "Excelente", "Bom", "Regular", "Baixo"
    value: number; // quantidade de leads
    percentage: number; // % do total
  }[];
  avgScore: number;  // média geral
  totalAudited: number;  // total com compliance
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/leads/LeadsComplianceChart.tsx` | **CRIAR** - Componente do gráfico gauge |
| `src/pages/Leads.tsx` | Adicionar cálculo de complianceData e renderizar o novo chart |

## Resultado Esperado

O gráfico será exibido na grid de charts da página de Leads, mostrando:
- Score médio de compliance no centro do gauge
- Distribuição visual por faixa de performance
- Contagem e percentual de cada categoria na legenda
