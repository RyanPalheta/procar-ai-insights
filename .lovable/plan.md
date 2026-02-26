

# Adicionar suporte ao campo `is_walking` no ingest-interaction

## Resumo
Adicionar logica no Edge Function `ingest-interaction` para aceitar o campo `is_walking` no payload e atualizar o lead correspondente, seguindo o mesmo padrao ja usado para `sales_status`.

## Como enviar via API
Basta incluir `is_walking` no corpo da requisicao:

```json
POST /functions/v1/ingest-interaction
{
  "session_id": 123,
  "channel": "whatsapp",
  "message_text": "Cliente entrou na loja",
  "sender_type": "agent",
  "is_walking": true
}
```

## Alteracao tecnica

### Arquivo: `supabase/functions/ingest-interaction/index.ts`

Adicionar um bloco apos o trecho existente de `sales_status` que:
1. Verifica se `body.is_walking` foi enviado (nao undefined)
2. Busca o valor atual do lead
3. Compara com o novo valor
4. Se diferente, faz UPDATE no `lead_db` e registra no `lead_history`
5. Retorna `is_walking_updated: true` na resposta

O padrao e identico ao ja implementado para `sales_status`, apenas aplicado ao campo booleano `is_walking`.

### Arquivos modificados
1. `supabase/functions/ingest-interaction/index.ts` - adicionar handler para `is_walking`

