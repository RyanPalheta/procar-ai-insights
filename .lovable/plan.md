
# Plano: Reativar Auditoria de Compliance dos Vendedores

## Contexto Atual

- **Milestones de auditoria**: Já configurados para `[10, 20, 30, 40]` (a cada 10 interações)
- **Mensagens de vendedores**: Já começaram a ser ingeridas (6 mensagens com `sender_type: 'agent'`)
- **Análise de compliance**: Atualmente **desativada** - todos os campos de playbook são forçados a `null`

## Alterações Necessárias

### 1. Modificar `analyze-lead` para incluir análise de compliance

**Arquivo**: `supabase/functions/analyze-lead/index.ts`

Alterações:
1. **Separar mensagens por tipo** - Dividir interações entre cliente e vendedor
2. **Buscar playbook correspondente** - Após identificar o produto, buscar o playbook na tabela
3. **Incluir playbook no prompt** - Adicionar conteúdo do playbook ao prompt de análise
4. **Adicionar campos de compliance no tool calling**:
   - `playbook_compliance_score` (0-100)
   - `playbook_steps_completed` (array de passos seguidos)
   - `playbook_steps_missing` (array de passos faltantes)
   - `playbook_violations` (texto com violações críticas)
   - `service_rating` (nota do atendimento 0-10)

5. **Remover a forçagem de campos para null** (linhas 344-349)

### 2. Estrutura do Novo Prompt

O prompt será expandido para incluir:

```text
MENSAGENS DO CLIENTE:
[mensagens com sender_type = 'client']

MENSAGENS DO VENDEDOR:
[mensagens com sender_type = 'agent']

PLAYBOOK A SER SEGUIDO ({product_type}):
[conteúdo do playbook correspondente ao produto identificado]

Avalie se o vendedor seguiu o playbook corretamente...
```

### 3. Fluxo de Análise Atualizado

```text
1. Receber session_id
2. Buscar todas as interações (cliente + vendedor)
3. Identificar produto desejado pelo cliente
4. Buscar playbook correspondente ao product_type
5. Enviar para IA com prompt completo
6. Retornar análise do lead + compliance do vendedor
7. Persistir via update-lead
```

## Detalhes Técnicos

### Consulta de Playbook

```typescript
// Após identificar o produto
const { data: playbook } = await supabase
  .from('playbooks')
  .select('title, content, steps')
  .eq('product_type', productType)
  .single();
```

### Campos Adicionais no Tool Calling

```typescript
playbook_compliance_score: {
  type: 'number',
  minimum: 0,
  maximum: 100,
  description: 'Score de aderência ao playbook (0-100)'
},
playbook_steps_completed: {
  type: 'array',
  items: { type: 'string' },
  description: 'Lista de passos do playbook que foram seguidos'
},
playbook_steps_missing: {
  type: 'array',
  items: { type: 'string' },
  description: 'Lista de passos do playbook que não foram seguidos'
},
playbook_violations: {
  type: 'string',
  nullable: true,
  description: 'Violações críticas identificadas no atendimento'
},
service_rating: {
  type: 'number',
  minimum: 0,
  maximum: 10,
  description: 'Nota geral do atendimento (0-10)'
}
```

### Remoção da Forçagem para Null

Remover linhas 344-349:
```typescript
// REMOVER ISSO:
playbook_compliance_score: null,
playbook_steps_completed: null,
playbook_steps_missing: null,
playbook_violations: null,
service_rating: null,
```

Substituir por valores do resultado da IA:
```typescript
playbook_compliance_score: analysisResult.playbook_compliance_score || null,
playbook_steps_completed: analysisResult.playbook_steps_completed || null,
playbook_steps_missing: analysisResult.playbook_steps_missing || null,
playbook_violations: analysisResult.playbook_violations || null,
service_rating: analysisResult.service_rating || null,
```

## Resultado Esperado

Após implementação:
- Leads com mensagens de vendedores terão análise de compliance
- Dashboard mostrará métricas de aderência ao playbook
- Auditorias automáticas a cada 10, 20, 30 e 40 interações
- Campos de compliance preenchidos na tabela `lead_db`

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/analyze-lead/index.ts` | Reativar análise de compliance, separar mensagens, incluir playbook no prompt |

## Considerações

- Se não houver mensagens de vendedor, os campos de compliance continuarão `null`
- Se não encontrar playbook para o produto, a análise de compliance não será feita
- O sistema é retrocompatível - leads antigos sem mensagens de vendedor não serão afetados
