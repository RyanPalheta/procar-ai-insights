
# Plano: Adicionar Campo "Objeção Contornada" à Análise de Leads

## Objetivo
Quando um lead apresenta uma objeção (`has_objection = true`), a IA também deve analisar se essa objeção foi contornada pelo vendedor durante a conversa, e exibir essa informação na UI do cartão do lead.

---

## Arquitetura da Mudança

```text
┌─────────────────────┐
│   analyze-lead      │
│   (Edge Function)   │
│   + Novo campo no   │
│     prompt/schema   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   update-lead       │
│   (Edge Function)   │
│   + Suporte ao      │
│     novo campo      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   lead_db           │
│   (Database)        │
│   + Nova coluna:    │
│   objection_overcome│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   LeadDetails.tsx   │
│   (UI)              │
│   + Badge visual    │
│   Contornada/Não    │
└─────────────────────┘
```

---

## Etapas de Implementação

### 1. Migration de Banco de Dados
Adicionar nova coluna na tabela `lead_db`:

```sql
ALTER TABLE lead_db 
ADD COLUMN objection_overcome boolean DEFAULT null;

COMMENT ON COLUMN lead_db.objection_overcome IS 
  'Indica se a objeção do cliente foi contornada pelo vendedor (análise de IA)';
```

---

### 2. Edge Function: `analyze-lead`

**Arquivo:** `supabase/functions/analyze-lead/index.ts`

**Alterações:**
- **Prompt do usuário** (linha ~270-280): Adicionar pergunta 13:
  ```
  13. Se houve objeção, ela foi contornada/superada pelo vendedor? (sim/não)
  ```

- **Schema de tool parameters** (após linha 350): Adicionar propriedade:
  ```javascript
  objection_overcome: {
    type: 'boolean',
    nullable: true,
    description: 'Se a objeção apresentada foi contornada pelo vendedor (true/false, null se não houver objeção)'
  }
  ```

- **Payload de update** (após linha 460): Incluir novo campo:
  ```javascript
  objection_overcome: analysisResult.has_objection ? 
    (analysisResult.objection_overcome || false) : null
  ```

---

### 3. Edge Function: `update-lead`

**Arquivo:** `supabase/functions/update-lead/index.ts`

**Alteração** (após linha 149): Adicionar suporte ao campo:
```javascript
if (body.objection_overcome !== undefined) {
  updateData.objection_overcome = body.objection_overcome
}
```

---

### 4. UI: `LeadDetails.tsx`

**Arquivo:** `src/pages/LeadDetails.tsx`

**Alteração na seção de Objeção** (linhas ~519-544):

Adicionar badge visual após o checkbox de objeção:
- Se `has_objection = true` e `objection_overcome = true`: Badge verde "✅ Contornada"
- Se `has_objection = true` e `objection_overcome = false`: Badge vermelho "❌ Não Contornada"
- Se `has_objection = true` e `objection_overcome = null`: Badge cinza "? Não analisado"

```tsx
{(lead as any).has_objection && (
  <Badge 
    variant={objection_overcome ? "success" : "destructive"}
    className={objection_overcome ? "bg-green-500" : "bg-red-500"}
  >
    {objection_overcome ? "✅ Contornada" : "❌ Não Contornada"}
  </Badge>
)}
```

---

## Resumo Visual da UI

| Cenário | Exibição |
|---------|----------|
| `has_objection = false` | ☐ Não |
| `has_objection = true`, `objection_overcome = true` | ☑ Sim - "preço alto" **✅ Contornada** |
| `has_objection = true`, `objection_overcome = false` | ☑ Sim - "prazo curto" **❌ Não Contornada** |
| `has_objection = true`, `objection_overcome = null` | ☑ Sim - "distância" *(sem badge)* |

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migration para coluna |
| `supabase/functions/analyze-lead/index.ts` | Prompt + schema + payload |
| `supabase/functions/update-lead/index.ts` | Suporte ao campo |
| `src/pages/LeadDetails.tsx` | UI visual |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

---

## Seção Técnica

### Lógica de Análise da IA

A IA receberá instrução específica no prompt:
```
13. Se o cliente apresentou objeção, analise se o vendedor conseguiu contorná-la:
    - Contornada (true): O vendedor apresentou argumentos, ofereceu soluções, ou o cliente demonstrou aceitar/entender
    - Não contornada (false): A objeção permaneceu sem resposta adequada ou o cliente manteve a resistência
```

### Condição no Payload

```javascript
// Só popula objection_overcome se houver objeção
objection_overcome: analysisResult.has_objection 
  ? (analysisResult.objection_overcome ?? false) 
  : null
```

Isso garante que o campo só seja preenchido quando relevante.
