# Plano para aposentar o n8n — inventário verificado e sequência segura

> **Data** 7 de junho de 2026 · **Elaborado por** Marcos Venâncio (BI/Dev)
> **Por que este doc** Antes de "aposentar o n8n" é preciso saber **tudo** que ele faz — inclusive o tracking Meta. Aposentar às cegas quebra, no mínimo, a **ingestão em tempo real do chat**.
>
> **Aviso de evidência:** o conteúdo dos workflows do n8n **não foi inspecionado** nesta rodada (não há acesso ao servidor pelo repo). O que segue vem do `DIAGNOSTICO-CONFIABILIDADE-DADOS.md` (§1.1, inspeção anterior do servidor) + do código deste repo. Onde está "a confirmar", é porque **não foi verificado**.

## TL;DR (honesto)

O n8n **não é só sincronização**: ele faz a **ingestão em tempo real** do chat (Evolution API → `ingest-lead`/`ingest-interaction`) com um **passo de IA** (workflows `Ingest_Dash_client/sales`, tipados "agente de IA / chatTrigger" no diagnóstico — pelo nome, voltados a **ingerir/classificar** a conversa) e, **provavelmente, o tracking Meta**. Portanto:

- **Aposentar o n8n agora quebraria a ingestão em tempo real do chat** (e o `interaction_db`). **A confirmar no servidor:** se o **atendimento ao cliente** (bot que responde) e o **tracking Meta** também rodam no n8n — não há evidência disso no repo, nem o contrário. Não é tarefa de dashboard.
- O **dashboard** já está quase 100% independente do n8n (syncs em código). Falta **uma** mudança pequena no n8n: enviar uma **chave** (telefone ou `kommo_lead_id`) no ingest do chat — isso destrava o dedup/fonte-única.
- **Acesso:** os workflows do n8n vivem no servidor `root@5.181.218.168` (fora deste repo). Quem edita o n8n precisa de acesso ao servidor; não dá para fazer a partir do repositório.

## Inventário verificado (código + diagnóstico do servidor)

| Workflow n8n | Status | Faz o quê | Equivalente em código | Quebra se desligar? |
|---|---|---|---|---|
| `Ingest_Dash_client` / `Ingest_Dash_sales` (chatTrigger, "agente de IA") | **ATIVO** | Ingestão do chat com passo de IA → chama os `ingest-*` (nome = "Ingest_Dash"). Se **também responde** ao cliente: **não confirmado** | ❌ nenhum | 🟠 Ingestão em tempo real para; atendimento = **a confirmar** |
| `Webhook -> Dashboard Ingest (Message sent)` | **ATIVO** | Ingestão em tempo real do chat (Evolution → `ingest-lead`/`ingest-interaction`) | parcial (`sync-kommo` cobre volume com 1h de atraso, sem tempo real e sem mensagens) | 🟠 Sim — perde tempo real + `interaction_db` |
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

1. **(n8n, pequeno)** Enviar `phone`/`kommo_lead_id` no ingest do chat → dedup liga; dashboard vira fonte única confiável. *Resolve o objetivo do dashboard sem mexer no atendimento.*
2. **(servidor)** Exportar e auditar os workflows: confirmar **tracking Meta (CAPI/pixel)** e o **polling IG/FB**; migrar para código o que precisar continuar.
3. **(a confirmar primeiro)** Verificar no servidor se o **atendimento ao cliente** (bot que responde) roda no n8n. **Se** rodar, reescrevê-lo fora (listener Evolution + LLM) é o maior item; **se não** rodar no n8n, este passo cai.
4. **(código)** Migrar a **ingestão em tempo real** (Evolution webhook → edge function) e os **gatilhos de análise** (hoje por marcos no `ingest-interaction`).
5. **Só então** desligar o n8n.

## O que já está pronto em código (não depende do n8n)
`sync-kommo` (mirror Kommo, com telefone), `sync-shopmonkey`, `reconcile-kommo`, dedup fase 2 (flag + view + cron), `ingest-lead` aceitando telefone, `twilio-webhook`/`ingest-call`, `meta-ads` (leitura), `sync-google-reviews`, `sync-seller-to-kommo`.

## O que eu (assistente) NÃO consigo fazer daqui
- **Editar o n8n** (sem acesso ao servidor `5.181.218.168`).
- **Ver o tracking Meta ao vivo** nos workflows do n8n.

Para avançar nos itens do n8n: me dê o **export JSON dos workflows** (aí produzo as edições exatas) ou rode os comandos via `! ssh ...` que eu preparo.
