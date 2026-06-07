# Plano para aposentar o n8n — inventário verificado e sequência segura

> **Data** 7 de junho de 2026 · **Elaborado por** Marcos Venâncio (BI/Dev)
> **Por que este doc** Antes de "aposentar o n8n" é preciso saber **tudo** que ele faz — inclusive o tracking Meta. Aposentar às cegas quebra, no mínimo, a **ingestão em tempo real do chat**.
>
> **Aviso de evidência:** o conteúdo dos workflows do n8n **não foi inspecionado** nesta rodada (não há acesso ao servidor pelo repo). O que segue vem do `DIAGNOSTICO-CONFIABILIDADE-DADOS.md` (§1.1, inspeção anterior do servidor) + do código deste repo. Onde está "a confirmar", é porque **não foi verificado**.

## TL;DR (honesto)

**Confirmado (dono + código):** a função do n8n no chat é **só empurrar a conversa para o DASHBOARD** — `ingest-lead` → `lead_db` e `ingest-interaction` → `interaction_db`. Ele **NÃO** faz o ingest no **CRM** (isso é o `sync-to-kommo`), **NÃO** roda a **IA** (isso é o `analyze-lead`, disparado *dentro* do `ingest-interaction:240`, não pelo n8n) e **NÃO** é o **atendimento** ao cliente. Fora o chat, o n8n **provavelmente** faz o **tracking Meta** (a confirmar no servidor).

- Logo, aposentar o n8n é **pequeno**: substituir a **ponte chat→dashboard** por código (um listener da Evolution que escreve em `lead_db`/`interaction_db` **já com o telefone**) e tratar o tracking Meta. **Não há** atendimento/CRM/IA para reescrever.
- O que se perde se só desligar sem substituir: o chat **em tempo real** (`interaction_db`, que alimenta o `analyze-lead`). O **volume** dos leads já vem da Kommo via `sync-kommo`.
- Atalho que resolve o dashboard **sem aposentar nada**: o n8n incluir uma **chave** (telefone ou `kommo_lead_id`) no POST do ingest do chat — destrava o dedup/fonte-única.
- **Acesso:** os workflows do n8n vivem no servidor `root@5.181.218.168` (fora deste repo). Quem edita o n8n precisa de acesso ao servidor; não dá para fazer a partir do repositório.

## Inventário verificado (código + diagnóstico do servidor)

| Workflow n8n | Status | Faz o quê | Equivalente em código | Quebra se desligar? |
|---|---|---|---|---|
| `Ingest_Dash_client` / `Ingest_Dash_sales` + `Webhook -> Dashboard Ingest` | **ATIVO** | **Só** empurram a conversa do WhatsApp (Evolution) para o **dashboard** (`ingest-lead`/`ingest-interaction`). **Não** tocam CRM/IA/atendimento (confirmado pelo dono). | listener Evolution → edge function (a construir) + `sync-kommo` (volume) | 🟠 Perde o chat **em tempo real** + `interaction_db` (volume já vem do `sync-kommo`) |
| `ATLAS - Ingestao de Chamadas` (cron) | **ATIVO** | Ingestão de chamadas | `twilio-webhook` + `ingest-call` (existem) | 🟡 Verificar quem é a fonte real das chamadas |
| `Retrieve leads (past 3 months)` | **OFF** | Puxaria todos os leads da Kommo | ✅ `sync-kommo` (cron horário) | ✅ Já substituído |
| `Update leads with ShopMonkey data` | **OFF** | Atualizar leads c/ ShopMonkey | ✅ `sync-shopmonkey` (cron) | ✅ Já substituído |
| `Polling Kommo - FB/IG Agent Messages` | **OFF** | Ingestão de mensagens IG/FB | ❌ nenhum | 🟡 Está desligado |
| `Clean duplicates...` | **OFF** | Dedup | ✅ dedup fase 2 (migration `20260607000000`) | ✅ Coberto (não-destrutivo) |

### Tracking Meta — onde está, de fato
- **Neste repo:** `meta-ads` (edge function) é **só leitura** da Graph API v21.0 (impressões, cliques, gasto, etc.). **Não há** Conversions API (CAPI), pixel, `fbclid/fbc/fbp`, nem push de eventos para a Meta.
- **No n8n / servidor:** o tracking Meta que envia eventos/atribuição (se existir CAPI/pixel) **não está neste repositório** e **precisa ser confirmado no servidor** antes de desligar qualquer coisa. `Polling Kommo - FB/IG Agent Messages` está OFF.
- **Ação obrigatória antes de aposentar:** exportar os workflows do n8n (JSON) e procurar `graph.facebook`, `capi`, `conversions`, `pixel`, `access_token`, `act_`. Sem isso, **não desligar**.

## O bloqueio do dashboard é pequeno (e isolado do atendimento)

Para o **dedup / fonte única** funcionar, falta só o n8n **enviar uma chave** no ingest do chat. O `ingest-lead` já aceita `body.phone` (feito); o ideal é também `body.kommo_lead_id`.

**Mudança mínima no n8n (workflow `Webhook -> Dashboard Ingest`):** incluir no corpo do POST para `ingest-lead`:
```json
{ "lead_id": <id>, "channel": "...", "phone": "{{ $json.remoteJid | só dígitos }}", "kommo_lead_id": <id do lead na Kommo, se houver> }
```
- `phone` → liga o dedup chat↔Kommo por telefone (já implementado).
- `kommo_lead_id` (melhor ainda) → permitiria casar a linha de chat com o espelho Kommo de forma exata (1 linha por lead) — chat vira **enriquecimento**, não duplicata.

## Sequência segura para realmente aposentar o n8n (faseada)

1. **(atalho — resolve o dashboard)** n8n incluir `phone`/`kommo_lead_id` no POST do ingest do chat → liga o dedup/fonte-única, **sem aposentar nada**. (`ingest-lead` já aceita.)
2. **(código — substitui a ponte)** Construir um **listener da Evolution** (edge function) que recebe a conversa e escreve em `lead_db`/`interaction_db` **com o telefone**, replicando o que o n8n faz hoje. O `analyze-lead` continua sendo disparado pelo `ingest-interaction` (sem mudança).
3. **(servidor)** Auditar os workflows e migrar o **tracking Meta** (CAPI/pixel) e o **polling IG/FB** (se existir) para código.
4. **(corte)** Repontar o webhook da Evolution para a nova edge function e **desligar** os workflows de ingest do n8n.
5. **Validar** volume + mensagens antes de remover o n8n de vez.

## O que já está pronto em código (não depende do n8n)
`sync-kommo` (mirror Kommo, com telefone), `sync-shopmonkey`, `reconcile-kommo`, dedup fase 2 (flag + view + cron), `ingest-lead` aceitando telefone, `twilio-webhook`/`ingest-call`, `meta-ads` (leitura), `sync-google-reviews`, `sync-seller-to-kommo`.

## O que eu (assistente) NÃO consigo fazer daqui
- **Editar o n8n** (sem acesso ao servidor `5.181.218.168`).
- **Ver o tracking Meta ao vivo** nos workflows do n8n.

Para avançar nos itens do n8n: me dê o **export JSON dos workflows** (aí produzo as edições exatas) ou rode os comandos via `! ssh ...` que eu preparo.
