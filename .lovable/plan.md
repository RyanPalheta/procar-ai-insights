

## Plano: Classificação de Objeções como Multi-Select pela IA

### Problema Atual
O ranking de objeções atual tenta extrair categorias de texto livre (`objection_detail`), resultando em categorias inconsistentes e pouco úteis. Por exemplo:
- "O cliente considera o preço proposto muito alto..."
- "O preço do serviço de instalação foi considerado muito caro..."

Ambos são sobre **preço**, mas aparecem como categorias diferentes.

### Solução Proposta
Modificar a análise de IA para classificar objeções em **categorias predefinidas** (como um multi-select), permitindo que um lead tenha múltiplas categorias de objeção.

### Categorias de Objeção (Multi-Select)

| Categoria | Descrição |
|-----------|-----------|
| `preco` | Preço alto, orçamento limitado, busca desconto |
| `tempo` | Tempo de espera, agenda ocupada, prazo |
| `distancia` | Localização, distância da loja |
| `financiamento` | Parcelamento, juros, forma de pagamento |
| `confianca` | Qualidade, garantia, desconfiança |
| `concorrencia` | Comparando com outros, já tem proposta |
| `tecnica` | Dúvida técnica, compatibilidade |
| `indecisao` | Precisa pensar, não está pronto |

### Alterações Necessárias

#### 1. Banco de Dados - Nova Coluna

```sql
ALTER TABLE lead_db 
ADD COLUMN objection_categories text[] DEFAULT NULL;

COMMENT ON COLUMN lead_db.objection_categories IS 
'Array de categorias de objeção classificadas pela IA (multiselect)';
```

Exemplo de valores:
- `['preco']` → Lead com objeção apenas de preço
- `['preco', 'financiamento']` → Lead quer desconto E parcelamento
- `['tempo', 'distancia']` → Lead com problemas de agenda E localização

#### 2. Edge Function - Modificar `analyze-lead`

Adicionar novo campo no tool calling da IA:

```typescript
// Adicionar nas propriedades do tool
objection_categories: {
  type: 'array',
  items: {
    type: 'string',
    enum: ['preco', 'tempo', 'distancia', 'financiamento', 
           'confianca', 'concorrencia', 'tecnica', 'indecisao']
  },
  description: 'Categorias de objeção identificadas (pode ser múltiplas). ' +
    'preco: preço alto ou busca desconto; ' +
    'tempo: agenda ocupada ou tempo de espera; ' +
    'distancia: localização longe; ' +
    'financiamento: parcelamento ou forma de pagamento; ' +
    'confianca: qualidade ou garantia; ' +
    'concorrencia: comparando com outros; ' +
    'tecnica: dúvida técnica; ' +
    'indecisao: precisa pensar mais'
}
```

Atualizar o prompt para instruir a IA:

```
11. Se houve objeção, classifique em UMA ou MAIS categorias:
    - preco (preço alto, orçamento limitado, busca desconto)
    - tempo (tempo de espera, agenda ocupada, prazo)
    - distancia (localização, distância da loja)
    - financiamento (parcelamento, juros, forma de pagamento)
    - confianca (qualidade, garantia, desconfiança)
    - concorrencia (comparando com outros, já tem proposta)
    - tecnica (dúvida técnica, compatibilidade)
    - indecisao (precisa pensar, não está pronto)
```

#### 3. Frontend - Atualizar Ranking

Modificar `src/pages/Leads.tsx` para usar `objection_categories` ao invés de parsear `objection_detail`:

```typescript
// Novo cálculo de objectionCounts
const objectionCounts = new Map<string, number>();
globalFilteredLeads.forEach(l => {
  const categories = (l as any).objection_categories as string[] | null;
  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      objectionCounts.set(cat, (objectionCounts.get(cat) || 0) + 1);
    });
  }
});

// Mapear categorias para labels legíveis
const categoryLabels: Record<string, string> = {
  'preco': 'Preço/Orçamento',
  'tempo': 'Tempo/Agenda',
  'distancia': 'Localização',
  'financiamento': 'Financiamento',
  'confianca': 'Confiança/Qualidade',
  'concorrencia': 'Concorrência',
  'tecnica': 'Dúvida Técnica',
  'indecisao': 'Indecisão'
};

const objectionsData = Array.from(objectionCounts.entries())
  .map(([key, value]) => ({ 
    name: categoryLabels[key] || key, 
    value 
  }))
  .sort((a, b) => b.value - a.value);
```

### Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────────┐
│  ANTES (Texto Livre)                                             │
│  objection_detail: "O preço está muito alto para mim"           │
│  → Parsing manual → Inconsistente                                │
├──────────────────────────────────────────────────────────────────┤
│  DEPOIS (Multi-Select Classificado pela IA)                     │
│  objection_detail: "O preço está muito alto para mim"           │
│  objection_categories: ["preco"]                                 │
│  → Agregação direta → Ranking preciso                            │
└──────────────────────────────────────────────────────────────────┘
```

### Exemplo de Resultado no Gráfico

```
┌─────────────────────────────────────────────────────────────┐
│  Ranking de Objeções                                        │
│  ──────────────────────────────────────────────────────────│
│  Preço/Orçamento    ████████████████████  18 leads (45%)   │
│  Tempo/Agenda       ██████████            9 leads (23%)    │
│  Indecisão          ██████                6 leads (15%)    │
│  Financiamento      ████                  4 leads (10%)    │
│  Localização        ███                   3 leads (7%)     │
└─────────────────────────────────────────────────────────────┘
```

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| **Migration SQL** | Criar coluna `objection_categories` no `lead_db` |
| `supabase/functions/analyze-lead/index.ts` | Adicionar `objection_categories` no tool calling |
| `src/pages/Leads.tsx` | Usar `objection_categories` para calcular ranking |
| `src/components/leads/LeadsObjectionsChart.tsx` | Ajustar se necessário |

### Benefícios

1. **Precisão**: Categorias consistentes e comparáveis
2. **Multi-Select**: Um lead pode ter múltiplas objeções (ex: preço E tempo)
3. **Métricas confiáveis**: Ranking reflete padrões reais de objeção
4. **Acionável**: Equipe pode criar estratégias por categoria
5. **Retrocompatibilidade**: Mantém `objection_detail` para contexto detalhado

### Observação sobre Leads Existentes

Os leads já analisados terão `objection_categories = NULL`. O ranking exibirá apenas leads re-analisados. Opcionalmente, pode-se criar um script para re-analisar leads com objeções existentes.

