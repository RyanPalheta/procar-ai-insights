

## Substituir IA: Lovable AI Gateway → Google Gemini 2.5 Flash (API direta)

### O que muda

A funcao `analyze-lead` atualmente usa o Lovable AI Gateway com o modelo `google/gemini-2.5-flash`. Vamos trocar para chamar a API do Google Gemini diretamente com sua propria API key.

### Abordagem

O Google oferece um endpoint compativel com o formato OpenAI, o que significa que as mudancas sao minimas -- apenas URL, modelo e autenticacao mudam. O formato de tools/tool_choice permanece identico.

### Passos

1. **Solicitar sua Google API Key** via ferramenta de secrets (nome: `GOOGLE_GEMINI_API_KEY`)
2. **Atualizar `supabase/functions/analyze-lead/index.ts`**:
   - URL: de `https://ai.gateway.lovable.dev/v1/chat/completions` para `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
   - Modelo: de `google/gemini-2.5-flash` para `gemini-2.5-flash`
   - Auth: de `LOVABLE_API_KEY` para `GOOGLE_GEMINI_API_KEY`
   - Versao: atualizar `AI_VERSION` para refletir a mudanca
3. **Deploy** da edge function

### Detalhes Tecnicos

**Linhas 9-12** (constantes):
```typescript
// De:
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.5-flash';
const AI_VERSION = 'lovable-ai-gemini-flash-v3';

// Para:
const AI_GATEWAY = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_MODEL = 'gemini-2.5-flash';
const AI_VERSION = 'google-gemini-flash-v1';
```

**Linhas 55-59** (autenticacao):
```typescript
// De:
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
if (!lovableApiKey) {
  throw new Error('LOVABLE_API_KEY is not configured');
}

// Para:
const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
if (!geminiApiKey) {
  throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
}
```

**Linha 446** (header):
```typescript
// De:
'Authorization': `Bearer ${lovableApiKey}`,
// Para:
'Authorization': `Bearer ${geminiApiKey}`,
```

Nenhuma outra mudanca necessaria -- o formato de tools, tool_choice e parsing da resposta sao identicos entre o Lovable AI Gateway e o endpoint OpenAI-compativel do Google.

