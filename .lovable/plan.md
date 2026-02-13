
## Plano: Exclusão de Valores Nulos nos Filtros

### Problema Identificado
Atualmente, quando um filtro como temperatura, score, sentimento, serviço ou compliance não está ativado (está em "all"), leads com valores **null** nesses campos ainda aparecem na tabela. O usuário quer que leads com esses campos vazios sejam desconsiderados (excluídos automaticamente).

### Solução

**Arquivo**: `src/pages/Leads.tsx`

Na função `filteredLeads` (linhas 168-255), adicionar validações que excluem registros com valores `null` para os campos quando o filtro está ativado:

1. **Filtro de Produto (service_desired)**
   - Quando `productFilter !== "all"`: Exclusão já existe
   - Quando `productFilter === "all"`: Adicionar exclusão de leads onde `service_desired` é `null`

2. **Filtro de Sentimento (sentiment)**
   - Quando `sentimentFilter !== "all"`: Exclusão já existe
   - Quando `sentimentFilter === "all"`: Adicionar exclusão de leads onde `sentiment` é `null`

3. **Filtro de Temperatura (lead_temperature)**
   - Quando `temperatureFilter !== "all"`: Exclusão já existe
   - Quando `temperatureFilter === "all"`: Adicionar exclusão de leads onde `lead_temperature` é `null`

4. **Filtro de Score (lead_score)**
   - Já existe lógica parcial (linhas 191-195) mas precisa ser aprimorada
   - Excluir registros com `lead_score === null` quando score é usado para qualquer filtro

5. **Filtro de Compliance (playbook_compliance_score)**
   - Já existe lógica parcial (linhas 198-202) mas precisa ser aprimorada
   - Excluir registros com `playbook_compliance_score === null` quando compliance é usado para qualquer filtro

### Implementação

Modificar a lógica dentro de `filteredLeads` para adicionar verificações no início do filtro:

```typescript
// Excluir leads com valores nulos nos campos de filtro
if (lead.service_desired === null) return false;
if (lead.sentiment === null) return false;
if (lead.lead_temperature === null) return false;
if (lead.lead_score === null) return false;
if (lead.playbook_compliance_score === null) return false;
```

Essas validações garantem que apenas leads com dados completos nesses campos apareçam na tabela.

### Impacto Esperado

- Redução no número de leads exibidos (remover aqueles com dados incompletos)
- Dados mais consistentes na tabela
- Melhor qualidade de análise e insights sem valores ausentes
- Usuário vê apenas leads com informações completas

### Detalhes da Modificação

**Local**: Linha ~176 em `src/pages/Leads.tsx`, logo após a verificação `if (!matchesSearch) return false;`

**Inserir antes dos filtros específicos**:
```typescript
// Exclude leads with null values in analyzed fields
if (lead.service_desired === null || 
    lead.sentiment === null || 
    lead.lead_temperature === null || 
    lead.lead_score === null || 
    lead.playbook_compliance_score === null) {
  return false;
}
```

Isso garante que qualquer lead com dados incompletos nesses campos será automaticamente excluído dos resultados.

