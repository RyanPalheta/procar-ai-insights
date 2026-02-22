
## Corrigir falhas de auto-analise e melhorar diagnostico

### Problema
267 chamadas automaticas da `analyze-lead` falharam com erro generico "Edge Function returned a non-2xx status code". O sistema nao captura o motivo real da falha, impossibilitando o diagnostico.

### Solucao em 2 partes

#### Parte 1: Melhorar captura de erro no `ingest-interaction`

**Arquivo**: `supabase/functions/ingest-interaction/index.ts`

Quando `supabase.functions.invoke` falha, o objeto de erro contem um campo `context` com o body da resposta. Vamos capturar isso e gravar no audit_log:

```typescript
// Atual (linha ~190-210):
const { data: analysisResult, error: analysisErr } = await supabase.functions.invoke('analyze-lead', {
  body: { session_id: sessionId }
});

if (analysisErr) {
  // Apenas loga mensagem generica
  await supabase.from('audit_logs').insert({
    error_message: analysisErr.message  // "Edge Function returned a non-2xx status code"
  });
}

// Novo:
const { data: analysisResult, error: analysisErr } = await supabase.functions.invoke('analyze-lead', {
  body: { session_id: sessionId }
});

if (analysisErr) {
  // Capturar detalhes reais do erro
  let errorDetail = analysisErr.message;
  try {
    if (analysisResult) {
      errorDetail = typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult);
    }
  } catch {}

  await supabase.from('audit_logs').insert({
    error_message: errorDetail,  // Agora com detalhes reais
    event_details: { milestone, error: errorDetail, raw_response: analysisResult }
  });
}
```

#### Parte 2: Adicionar tratamento de erro mais robusto na `analyze-lead`

**Arquivo**: `supabase/functions/analyze-lead/index.ts`

Garantir que todos os erros internos (Gemini API, parsing, etc.) sejam logados no audit_logs antes de retornar o status de erro, para que tenhamos visibilidade mesmo sem acesso aos logs da edge function.

Adicionar um try/catch mais granular ao redor da chamada ao Gemini para distinguir entre:
- Erro de API key
- Timeout
- Rate limiting (429)
- Erro de parsing da resposta

### Detalhes tecnicos

**ingest-interaction/index.ts** - Linhas ~188-215:
- Alterar o bloco de captura de erro para extrair `analysisResult` (que contem o body do erro quando status != 2xx)
- O SDK do Supabase retorna `data` com o corpo da resposta mesmo em caso de erro non-2xx

**analyze-lead/index.ts** - Ao redor da chamada fetch ao Gemini (~linha 446):
- Capturar o status code da resposta do Gemini
- Se 429: logar "rate_limit" no audit_logs
- Se 401/403: logar "auth_error" 
- Se timeout: logar "timeout"
- Gravar sempre o response body no audit_log para diagnostico futuro

### Resultado esperado
- Proximas falhas terao o **motivo real** registrado no audit_logs
- A pagina de Logs mostrara detalhes uteis em vez de "Edge Function returned a non-2xx status code"
- Sera possivel identificar e corrigir a causa raiz das 267+ falhas
