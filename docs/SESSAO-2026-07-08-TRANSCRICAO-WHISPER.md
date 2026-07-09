# Sessão 2026-07-08 — Transcrição de ligações migrada para Whisper — Pro Car AI Insights

**Data:** 2026-07-08 · **Elaborado por:** Marcos Venâncio (BI/Dev) · **Branch:** `main` (mergeada de `feat/whisper-transcription`, PR #76) · **Commits:** `a6580fd`, `c948280`

> **TL;DR:** A transcrição de ligações vinha com qualidade baixa e a auditoria por IA (`analyze-call`) não avaliava direito. Diagnóstico: o n8n transcrevia pela **transcrição interna da Innovat** (`gpt-4o-transcribe-diarize`), que sai curta/fragmentada. Substituí por **OpenAI Whisper (`whisper-1`)** numa nova edge function `transcribe-call` que baixa o áudio bruto da Innovat, transcreve, limpa o loop de repetição do Whisper e dispara a auditoria. Deployado no barssss, **n8n** ajustado (nós de transcrição desligados) e **backfill de 30 dias** (887/887 ligações re-transcritas). Tudo no ar e verificado.

---

## 1. Problema

- Transcrições de ligação de baixa qualidade → `analyze-call` (auditoria por IA) produzindo avaliações ruins.
- O endpoint de gravações da InnovatSolution (`recordings-api.innovatsolution.com`) foi disponibilizado pelo fornecedor (Gabriel) para pegarmos o áudio e transcrever por conta própria.

## 2. Diagnóstico

O workflow ativo do n8n `ATLAS - Ingestão de Chamadas` transcrevia pelos nós **`Transcribe Found/New` → `/portal/transcriptions`** (transcrição **interna** da Innovat, `gpt-4o-transcribe-diarize`). Comparação na mesma ligação (266s, inglês):

| Caminho | Resultado |
|---|---|
| Innovat `gpt-4o-transcribe-diarize` | 731 chars, diarizado mas **truncado/fragmentado** |
| OpenAI direto `gpt-4o-transcribe` | `"Hello?"` — **colapsou** (1 palavra) |
| OpenAI direto **`whisper-1`** | Conteúdo **completo e coerente** (com loop de repetição no fim, tratável) |

Fatores: (1) áudio de origem é **GSM 6.10, mono, 8 kHz** (telefonia lossy — teto de qualidade); (2) o modelo diarize é mais fraco que o `whisper-1` nesse áudio; (3) as ligações são em **inglês/espanhol/português** (loja nos EUA, equipe brasileira) — auto-detecção de idioma é essencial.

## 3. Solução implementada

**Nova edge function `transcribe-call`** (`supabase/functions/transcribe-call/index.ts`):
1. Recebe `{ call_id }`; lê `recording_sid` (= `cdrId` da Innovat) e a data.
2. **Relista** a Innovat para obter um `recordingRef` fresco (o ref é de uso único), mirando a janela pelo **timestamp Unix embutido nos 10 primeiros dígitos do `cdrId`** (±20min), com `limit=100`.
3. Baixa o WAV → **OpenAI `whisper-1`** (auto-idioma) → **`collapseRepeats()`** colapsa o loop de repetição do Whisper.
4. Salva `transcription_text` + `transcription_status='completed'` → dispara `analyze-call`.

**`ingest-call`** (`supabase/functions/ingest-call/index.ts`): quando há gravação, o **Whisper vira a fonte da verdade** e o `transcription_text` vindo do n8n é ignorado — assim não foi preciso reescrever o n8n para trocar a transcrição.

## 4. Deploy (barssss cloud)

- Deploy via **GitHub Actions** (`.github/workflows/deploy-functions.yml`, job "Deploy Edge Functions") — push na `main` deploya. O job de `db push` falha historicamente, mas o de functions **funciona**.
- Deploy imediato feito também via CLI com o token canônico da Pro Car (o `SUPABASE_ACCESS_TOKEN` da sessão é de outra conta e dá 403).
- **Secrets de runtime setados no barssss:** `OPENAI_API_KEY`, `ITP_API_KEY`, `ITP_BASE_URL`.
- Validação em produção: ligação `ccfad804` re-transcrita 1683 chars (inglês, coerente); `analyze-call` → `completed`, score 30, direção `passive`.

## 5. Ajuste no n8n

No workflow `ATLAS - Ingestão de Chamadas` (id `PHIdcbBhduXYjNlc`, VPS `root@5.181.218.168`, container `n8n_n8n_editor`): os nós **`Transcribe Found` e `Transcribe New` foram desligados** (`disabled=true`) — eram chamadas redundantes à Innovat/OpenAI, agora ignoradas pelo `ingest-call`. Workflow reativado e re-registrado no scheduler (restart do editor; worker/webhook intactos, chat em tempo real não caiu). Backup do workflow em `/tmp/atlas_backup.json` na VPS.

## 6. Backfill (últimos 30 dias)

Re-transcritas com Whisper todas as ligações com gravação dos últimos 30 dias (`force`, concorrência 4):

| Métrica | Valor |
|---|---|
| Ligações com gravação | **887** |
| Transcrições completed | **887 (100%)** · failed **0** |
| Auditorias refeitas | **885** (2 ligações quase mudas, sem o que auditar) |
| Média de caracteres | **1251** |

## 7. Armadilhas da recordings-api da InnovatSolution (referência técnica)

- **`limit` ≥ ~200 na listagem retorna VAZIO** (count 0). Usar `limit=100` + janela curta. (Foi o bug que quebrou o 1º deploy.)
- **`recordingRef` é de uso único / regenerado por request** — sempre re-listar antes de baixar `/audio?ref=`. O detalhe `GET /portal/recordings/:cdrId` **sem ref dá 404**.
- **Os 10 primeiros dígitos do `cdrId` = Unix timestamp (s, UTC)** do início da ligação — dá pra mirar a janela com precisão.
- Áudio entregue em **GSM 6.10, mono, 8 kHz**. `startDate/endDate` aceitam ISO com `Z` (UTC) ou offset.

## 8. Arquivos alterados

- `supabase/functions/transcribe-call/index.ts` (novo)
- `supabase/functions/ingest-call/index.ts` (Whisper como fonte da verdade)
- `supabase/config.toml` (registra `transcribe-call`)

## 9. Follow-ups (opcionais)

- Analisar as auditorias novas (agora sobre texto limpo) para revalidar scores/insights.
- Eventualmente remover de vez os nós Transcribe do n8n (hoje só desligados) e limpar a chave OpenAI antiga usada por eles.
