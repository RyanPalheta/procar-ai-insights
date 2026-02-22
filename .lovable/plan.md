

## Integracao Twilio: Gravacao + Transcricao + Analise IA

### Visao geral do fluxo

```text
Twilio (chamada finalizada)
    |
    v
[twilio-webhook] --> Recebe dados da chamada + URL da gravacao
    |                 Salva no call_db
    v
[transcribe-call] --> Baixa audio do Twilio
    |                  Transcreve com Google Gemini (suporta audio)
    |                  Salva transcricao no call_db
    v
[analyze-call] --> Analisa transcricao com IA
                   (compliance, sentimento, score)
                   Salva resultados no call_db
```

### O que sera feito

#### 1. Novas colunas no `call_db`

Adicionar campos para armazenar dados do Twilio e da transcricao:

- `twilio_call_sid` (text) - identificador unico da chamada no Twilio
- `from_number` (text) - numero de origem
- `to_number` (text) - numero de destino
- `call_status` (text) - status da chamada (completed, busy, no-answer, etc.)
- `recording_url` (text) - URL da gravacao no Twilio
- `recording_sid` (text) - SID da gravacao
- `transcription_text` (text) - texto transcrito da chamada
- `transcription_status` (text) - pending/processing/completed/failed
- `ai_call_analysis` (jsonb) - resultado da analise de IA da chamada

#### 2. Edge Function: `twilio-webhook`

Recebe o webhook do Twilio no formato `application/x-www-form-urlencoded` (padrao do Twilio). Extrai os dados da chamada, vincula a um lead (pelo numero de telefone ou session_id customizado) e salva no `call_db`. Apos salvar, dispara automaticamente a transcricao.

Campos recebidos do Twilio:
- `CallSid`, `CallStatus`, `CallDuration`, `From`, `To`
- `RecordingUrl`, `RecordingSid` (quando gravacao esta habilitada)

#### 3. Edge Function: `transcribe-call`

Baixa o audio da gravacao usando a API do Twilio (autenticacao via Account SID + Auth Token), envia o audio diretamente ao Google Gemini (que suporta entrada de audio nativamente) para transcrever, e salva o texto no `call_db`. Apos transcrever, dispara automaticamente a analise de IA.

#### 4. Edge Function: `analyze-call`

Similar ao `analyze-lead` existente, mas focado em chamadas telefonicas. Recebe o `call_id`, busca a transcricao do `call_db`, e envia ao Gemini para analise de:
- Compliance com playbook de vendas
- Sentimento do cliente
- Objecoes identificadas
- Score de qualidade da chamada
- Resumo executivo

#### 5. Atualizacao da pagina de Chamadas

- Exibir novos campos: numero de origem/destino, status Twilio, status da transcricao
- Botao para ver transcricao completa (dialog)
- Botao para ver analise de IA da chamada
- Badge de status da transcricao (pendente/processando/concluida)

#### 6. Secrets necessarios

Serao solicitados ao usuario:
- `TWILIO_ACCOUNT_SID` - Account SID do Twilio
- `TWILIO_AUTH_TOKEN` - Auth Token do Twilio

### Como configurar o Twilio (orientacao para voce)

Apos a implementacao, voce precisara:

1. **Criar conta no Twilio** em twilio.com (tem plano trial gratuito)
2. **Obter credenciais**: Account SID e Auth Token (encontrados no dashboard do Twilio)
3. **Configurar o webhook**: No Twilio, apontar o "Status Callback URL" das suas chamadas para a URL da edge function que sera gerada
4. **Habilitar gravacao**: Nas configuracoes de chamada do Twilio, ativar "Record Calls"

A URL do webhook sera algo como:
`https://hhxqmvkzhzrxzlirzlis.supabase.co/functions/v1/twilio-webhook`

### Detalhes tecnicos

**twilio-webhook** - Parsing de `application/x-www-form-urlencoded` (nao JSON), validacao de assinatura Twilio opcional, auto-criacao de call no banco, trigger assincrono de transcricao.

**transcribe-call** - Download do audio via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Recordings/{RecordingSid}.mp3` com Basic Auth, envio como base64 ao Gemini com instrucao de transcrever em portugues, salvamento do texto.

**analyze-call** - Reutiliza o modelo Gemini 2.5 Flash e a mesma GOOGLE_GEMINI_API_KEY ja configurada. Prompt customizado para analise de chamadas telefonicas de vendas.

**Config TOML** - Adicionar `[functions.twilio-webhook]`, `[functions.transcribe-call]`, e `[functions.analyze-call]` com `verify_jwt = false`.

