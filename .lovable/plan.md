

# Adicionar campos "Saudacao" e "Qualificacao" como booleanos na analise de IA

## Resumo
Criar dois novos campos booleanos na tabela `lead_db` (`has_greeting` e `has_qualification`) que serao preenchidos pela IA durante a analise, seguindo o mesmo padrao dos campos `has_objection`, `used_offer`, `used_anchoring`. Esses campos aparecerao nos KPIs do Painel 360, mas NAO nos cartoes de lead.

## Etapas

### 1. Migracao do banco de dados
Adicionar dois novos campos booleanos a tabela `lead_db`:
- `has_greeting` (boolean, default false) - indica se o vendedor fez a saudacao inicial
- `has_qualification` (boolean, default false) - indica se o vendedor realizou a qualificacao do cliente

### 2. Atualizar a Edge Function `analyze-lead`
No arquivo `supabase/functions/analyze-lead/index.ts`:
- Adicionar `has_greeting` e `has_qualification` aos parametros da tool calling da IA (junto com `has_objection`, `used_offer`, etc.)
- Adicionar instrucoes no prompt para a IA avaliar:
  - Se o vendedor se apresentou e cumprimentou o cliente
  - Se o vendedor fez perguntas de qualificacao (ano, modelo, necessidade, etc.)
- Incluir os novos campos no objeto de update enviado ao `update-lead`

### 3. Atualizar a Edge Function `update-lead`
Garantir que os campos `has_greeting` e `has_qualification` sejam aceitos e persistidos no update do lead.

### 4. Atualizar o Painel 360 (TVDashboard)
No arquivo `src/pages/TVDashboard.tsx`:
- Substituir a logica atual que tenta fazer `completed.includes("saudacao")` por uma leitura direta dos booleanos `lead.has_greeting` e `lead.has_qualification`
- Fazer isso tanto no calculo de `metrics` quanto no de `previousMetrics`

### 5. Atualizar os KPIs do Dashboard principal (Leads)
Se os KPIs de saudacao/qualificacao tambem aparecem no dashboard de leads, aplicar a mesma correcao.

## Detalhes tecnicos

### Migracao SQL
```sql
ALTER TABLE lead_db ADD COLUMN has_greeting boolean DEFAULT false;
ALTER TABLE lead_db ADD COLUMN has_qualification boolean DEFAULT false;
```

### Tool calling (analyze-lead) - novos campos
```typescript
has_greeting: {
  type: 'boolean',
  description: 'Se o vendedor fez saudacao inicial e se apresentou ao cliente'
},
has_qualification: {
  type: 'boolean',
  description: 'Se o vendedor realizou qualificacao do cliente (perguntas sobre necessidade, veiculo, ano, modelo, etc.)'
}
```

### TVDashboard - logica corrigida
```typescript
// Antes (quebrado):
if (completed.includes("saudacao")) acc.saudacao++;

// Depois (correto):
if (lead.has_greeting) acc.saudacao++;
if (lead.has_qualification) acc.qualificacao++;
```

### Arquivos modificados
1. Nova migracao SQL (schema)
2. `supabase/functions/analyze-lead/index.ts` - prompt + tool parameters + update payload
3. `supabase/functions/update-lead/index.ts` - aceitar novos campos
4. `src/pages/TVDashboard.tsx` - usar booleanos ao inves de parsear array

