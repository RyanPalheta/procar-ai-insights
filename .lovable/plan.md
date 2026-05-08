## Objetivo

Permitir que a transcrição da chamada seja enviada diretamente no payload do `ingest-call`, eliminando a dependência da função `transcribe-call`.

## Mudanças

### 1. `supabase/functions/ingest-call/index.ts`
- Aceitar novos campos opcionais no payload:
  - `transcription_text` (string) — texto completo da transcrição
  - `transcription_status` (string, opcional) — se omitido, será definido automaticamente como `"completed"` quando `transcription_text` for fornecido, ou `"pending"` caso contrário
- Salvar esses campos no insert em `call_db`
- Manter toda a lógica atual (dedup por `recording_sid`, auto-criação de lead, etc.)

### 2. Remover `supabase/functions/transcribe-call/`
- Apagar a pasta inteira da função
- Remover a entrada `[functions.transcribe-call]` do `supabase/config.toml`
- Deletar a função deployada via `delete_edge_functions`

### 3. Frontend (`src/pages/Calls.tsx`)
- Manter a coluna "Transcrição" e os badges de status — continuam funcionando normalmente, já que os campos `transcription_text` e `transcription_status` permanecem na tabela
- Nenhuma mudança visual necessária

## Novo formato do payload `ingest-call`

```json
{
  "session_id": 12345678,
  "type": "phone",
  "call_duration": 245,
  "from_number": "+5511999998888",
  "to_number": "+5511888877777",
  "recording_sid": "REabc123",
  "recording_url": "https://...",
  "transcription_text": "Vendedor: Olá... Cliente: Oi...",
  "call_direction": "outbound"
}
```

Quando `transcription_text` é enviado, o `transcription_status` é automaticamente marcado como `completed`, e a chamada já fica pronta para ser analisada pela função `analyze-call`.

## Observações

- A função `analyze-call` continua funcionando sem alterações — ela só lê `transcription_text` do `call_db`
- Webhooks/integrações que ainda dependiam de `transcribe-call` precisarão ser atualizados no n8n para enviar a transcrição diretamente no `ingest-call`
- A função `twilio-webhook` (que provavelmente chamava `transcribe-call`) deve ser revisada — quer que eu inclua essa revisão no plano?
