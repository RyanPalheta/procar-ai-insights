# Implementação — Checklist de Auditoria (A–P) + Tempo Real

> **Data:** 24–25 de junho de 2026 · **Elaborado por:** Marcos Venâncio (BI/Dev)
> **Escopo:** entrega do backlog do *Checklist de Auditoria do Dashboard de BI* (64 itens, seções A–P),
> mais a captação de mensagem inicial/absoluto, a padronização dos leads de ligação e a
> **infraestrutura de tempo real** (webhooks Kommo + ShopMonkey).
> **Banco/ambiente:** Supabase Cloud `barssssarrijyfzbwxep` (DASHBOARD_PROCAR). Frontend publicado na VPS
> `5.181.218.168` (service `procar-dashboard`, `dashboard.procarsoundsecuritytech.com`).

---

## Sumário executivo

- O PDF *Checklist de Auditoria* (64 itens) é o backlog mestre. **A letra do BLOCO = a seção (A–P).**
- Auditoria seção-a-seção feita no código real + dado real (não no que o PDF marcou — "OK ≠ funcional").
- Entregues os blocos anotados: **K, N, B, D, G, I, J, M, P**. **F e H** ficaram fora (decisão).
- Captação corrigida: **"I'm interested" = template de anúncio Meta** (~1.953 sessões, não 10).
- Padronização: **"Leads criados via ligação"** (etapa) + tag **"Ligação Twilio"** (683 leads).
- **Absoluto** capturado da mensagem + tag escrita no Kommo.
- **Motivo de perda do Kommo** (`loss_reason`) passou a sincronizar e alimentar o card "Local Distante".
- **Tempo real:** webhooks do **Kommo** (mudança de etapa) e do **ShopMonkey** (agendamento/venda) → edge functions que atualizam o banco na hora.

---

## 1. Fundação — parser de note + card amarelo

**O quê.** Base para todos os cards de "regra de captura": um tom visual amarelo e a extração
determinística de marcadores do *note* do agendamento ShopMonkey.

**Como.**
- `src/components/dashboard/KPICard.tsx`: nova prop **`tone="warning"`** → glow âmbar (`234,179,8`) + borda/fundo âmbar (dark incluso). O disclaimer "?" vai na prop `info` (renderiza dentro do card).
- `supabase/functions/_shared/parse-note.ts` estendido com novos campos no `ParsedNote`:
  - `upsell: string[]` — `(UPSELL: item1, item2)` (vírgula = 1 cada; **sem** "- Vendedor" no fim, por decisão).
  - `financing: string[]` — `SNAP` / `ACIMA` / `AMERICAN FIRST` (1 cada).
  - `isReferral: boolean` — note menciona `indicação`/`INDICACAO` em qualquer lugar.
  - `isAbsoluto: boolean` — note contém `absoluto`.
  - `phoneActiveBooking: boolean` — "APONTAMENTO MARCADO VIA TELEFONE ATIVO".
- Migration `20260624120000_shopmonkey_appointment_note_tokens.sql`: 5 colunas + índices (GIN p/ arrays, parciais p/ flags).
- `sync-shopmonkey/index.ts`: grava as colunas no upsert.

**Verificação.** parseNote testado com notes reais; **backfill dos 2.902 agendamentos** → `is_referral`=67, `financing`=22 (SNAP 20 + AMERICAN FIRST 2), `is_absoluto`=0, `phone_active_booking`=0, `upsell`=0 (a equipe ainda não escreve o formato). `sync-shopmonkey` redeployado.

---

## 2. Auditoria do Checklist (A–P)

**O quê.** Mapear cada seção do PDF → estado REAL no código → disponibilidade do dado → plano/esforço/bloqueio.

**Como.** Workflow de 16 agentes (1 por seção), cada um verificando o frontend + cruzando com os fatos do banco que eu havia levantado (distribuições reais de `lead_db.channel`, `sales_status`, `objection_categories`, `call_db`, `shopmonkey_appointment.source/channel`).

**Resultado (resumo):**

| Seç | Tema | Status real | Ação |
|---|---|---|---|
| A | msgs/dia por canal | parcial | disclaimer; #5/#6 por canal bloqueado (sm.channel ~79% null) |
| B | dias anteriores | ausente | RPC `get_ongoing_conversations_kpis` + cards |
| C | totais | parcial | (não priorizado) |
| D | orgânico "I'm interested" | ausente | RPC `get_organic_interested_kpis` + cards |
| E | ligações receptivas | **funcional** | direção já é estruturada (`src/lib/calls.ts`) |
| F | e-mail | **fora** | — |
| G | absoluto | ausente | pipeline de tag (ver §6) |
| H | conversão celular | **fora** | — |
| I | ligações follow-up/vendedor | ausente | RPC `get_followup_calls_by_seller` |
| J | agend. follow-up/vendedor | parcial | chip "Ligação" amarelo (já vinha por vendedor) |
| K | origem do agendamento | parcial | cards Indicação + Cliente Antigo |
| L | serviços/mensagem | **funcional** | scan-services + ProductIntelligence |
| M | upsell/vendedor | ausente | RPC `get_seller_upsell_kpis` |
| N | pipeline/perdas | parcial | RPC `get_pipeline_loss_kpis` |
| O | fechamento | parcial | (#54 ok; #55 referral-sales não priorizado) |
| P | auditoria geral | parcial | **export CSV/Excel/PDF** (#61) |

---

## 3. Cards e RPCs novos

Todas as RPCs seguem o contrato `date_from`/`date_to` + janela anterior (igual ao `get_leads_kpis`),
foram **aplicadas no barssss via Management API** e **versionadas como migrations** para o CI.

| RPC (migration) | Bloco | Card / componente |
|---|---|---|
| `get_appointment_origin_kpis` (`20260624130000`) | K #37/#38 | **Indicação** (67) + **Cliente Antigo** (86) em `LeadsKPICards.tsx` |
| `get_pipeline_loss_kpis` (`20260624140000`) | N #49/#50/#52 | `PipelineLossCards.tsx` — Perdidos, Local Distante, Financeiras, **Financiamento ShopMonkey** (SNAP/AMERICAN FIRST) |
| `get_seller_upsell_kpis` (`20260624150000`) | M #45-48 | chip **Upsell** por vendedor em `SellersRankingTable.tsx` (ShopMonkey + fallback IA) |
| `get_followup_calls_by_seller` (`20260624160000`) | I #29-31 | chip **Follow-up** (ligações ativas) por vendedor |
| `get_ongoing_conversations_kpis` (`20260624170000`) | B #7-12 | `OngoingConversationsCards.tsx` (total + WhatsApp/FB/IG) |
| `get_organic_interested_kpis` (`20260624180000`) | D #16-18 | `OrganicInterestedCards.tsx` |
| `get_absoluto_kpis` (`20260624190000`) | G #25-27 | `AbsolutoCards.tsx` |

**Frontend de apoio:**
- `src/lib/export.ts` (novo) — `exportToCsv` (BOM UTF-8), `exportToXlsx` (lib `xlsx` já instalada), `exportToPdf` (impressão em nova aba, cabeçalho ProCar). Botões em `src/pages/Leads.tsx` (exporta os leads **filtrados**).
- `src/pages/Dashboard.tsx` — fiação dos cards (queries separadas + spread de props).
- `J`: em `SellersRankingTable.tsx` o chip de canal `telefone` ("Ligação") foi pintado de amarelo + disclaimer (o backend `get_sellers_shopmonkey_kpis` já entregava por vendedor).

**Observação de cobertura.** Vários cards são **amarelos de propósito** — a métrica depende de uma regra de captura parcial (texto no note, objeção da IA, marcação manual). O disclaimer "?" explica a fonte e a limitação em cada um.

---

## 4. Investigações

### 4.1 "I'm interested" = template de anúncio Meta (BLOCO D corrigido)
A detecção do D usava o literal errado (`i am interested`) → só **10** sessões. O texto real é **"I'm interested in &lt;produto&gt;"** — o template pré-preenchido dos anúncios Meta (FB/IG click-to-message e click-to-WhatsApp). Padrão correto: regex `i.{0,2}m interested` (tolera apóstrofo reto/curvo). **~1.953 sessões** (wa 1398, fb 378, ig 177); o RPC `get_organic_interested_kpis` foi corrigido → card mostra **1.914**.

### 4.2 O que cria os leads "Aguardando atendimento"
Dos **1.211** leads nesse status: **97% têm `source_system` NULL** (criados pela ingestão em tempo real, não pelo `sync-kommo`). Maior canal: **phone = 574** — auto-criados pelo `ingest-call` (`index.ts:62-68`), dos quais 549 têm ligação real, **455 passivas / 94 ativas, 0 com chat**; muitas são não-venda (gatekeeper/fornecedor/"abertura fraca"). Chat (whatsapp/fb/ig ~600) criados pelo `ingest-interaction`; 185 são anúncio ("I'm interested"). O status "Aguardando atendimento" é espelhado do Kommo pelo `sync-kommo` (bloco 2b).

### 4.3 Captação da mensagem inicial
Fluxo: **Kommo webhook (`add_message`) → n8n → `ingest-interaction` → `interaction_db`**. Captura `{session_id, channel, message_text, sender_type}`; `timestamp` = hora do ingest. A origem/fonte do tráfego (campaign/ad id) **não** é capturada — só o texto-template serve de proxy.

---

## 5. Padronização dos leads de ligação

### 5.1 Etapa "Leads criados via ligação"
`src/pages/Dashboard.tsx` (gráfico **Leads por Status**): leads com `channel='phone'` são consolidados numa etapa única "Leads criados via ligação" (cor azul em `LeadsStatusChart.tsx`), em vez de espalhados em "Aguardando atendimento". É uma derivação ao vivo (cobre os antigos retroativamente).

### 5.2 Tag "Ligação Twilio" no Kommo
- **A partir de agora:** `ingest-call/index.ts` — ao auto-criar um lead de ligação, escreve a tag **"Ligação Twilio"** no Kommo (helper `addTagToKommo`, preserva tags existentes).
- **Retroativo:** modo `{backfill_twilio_tag:true}` (paginado por `offset/max`) + RPC `get_integration_call_lead_ids` (`20260625130000`) = leads `channel='phone'` com ligação e sem chat. **683 leads tagueados** (0 erros).

---

## 6. Absoluto (BLOCO G)

**Decisão:** "absoluto" é capturado por mensagem e vira uma TAG no lead no Kommo.

**Como (duas vias, ambas em tempo real):**
1. **Da mensagem:** `ingest-interaction/index.ts` — se a mensagem contém `absoluto`, marca `lead_db.is_absoluto=true` na hora **e** escreve a tag **"Absoluto"** no Kommo (`addAbsolutoTagToKommo`). Só age na transição (não re-PATCH a cada msg).
2. **Da tag (sync):** `sync-kommo/index.ts` (bloco 2c) lê a tag `absoluto` do lead (`_embedded.tags`) e marca `is_absoluto`.

**Backend:** migration `20260624190000_absoluto_pipeline.sql` (coluna `lead_db.is_absoluto` + RPC `get_absoluto_kpis`, que consulta `lead_db` direto com as exclusões do painel porque a view não expõe a coluna nova).

**Backfill:** 95 mensagens / 94 leads já tinham "absoluto" → marcados (card G saltou de 0 → **94**, 11 agendamentos). Tag no Kommo: modo `{backfill_absoluto:true}` no `ingest-interaction` → **90/95** tagueados.

---

## 7. Motivo de perda do Kommo (BLOCO N #50)

**Problema.** O card "Local Distante" só olhava a objeção da IA (`objection_categories`). Quando a equipe marca o **motivo de perda no Kommo** ("Local Muito Distante") ao mover para "Venda perdida", isso não chegava ao painel — não havia coluna `loss_reason`.

**Como.**
- Migration `20260625120000_lead_db_loss_reason.sql`: coluna `lead_db.loss_reason` + índice.
- `sync-kommo/index.ts`: busca `with=loss_reason`, grava `loss_reason` no insert e espelha nas linhas existentes (bloco 2d).
- `get_pipeline_loss_kpis` ajustado: **Local Distante** = perdido com `objection_categories @> {distancia}` **OU** `loss_reason ~* 'distan|local distante'` (consulta `lead_db` direto).

**Verificação.** Lead #23955763: status → "Venda perdida", `loss_reason` → "Local Muito Distante"; card passou a contabilizar (`lost_distancia=1`). Motivos reais sincronizados: "Local Muito Distante", "Carro Incompatível", "Lead Inconsciente", etc.

---

## 8. Tempo real (webhooks)

A grande mudança de arquitetura: parar de depender só dos crons horários para refletir mudanças.

### 8.1 Kommo — mudança de etapa/lead
- **Edge function `kommo-lead-webhook`** (novo): recebe o webhook do Kommo (form-encoded `leads[status|add|update][N][id]` ou JSON), busca o lead na API (`with=loss_reason,source_id` + mapa de pipelines) e atualiza `lead_db` na hora: **etapa, motivo de perda, absoluto**; insere se faltar (`source_system='kommo_webhook'`). Não clobbera enriquecimento. Registra `lead_history` na mudança de etapa.
- **Webhook registrado** (via API): eventos `add_lead` + `status_lead` → a edge function. (Loss reason só é definido ao mover para perdido, então `status_lead` cobre.)
- **Segurança:** `KOMMO_WEBHOOK_SECRET`; o destino no Kommo leva `?s=<secret>`; sem ele → 403 (protege os branches admin).

### 8.2 ShopMonkey — agendamento/venda
- **Edge function `shopmonkey-webhook`** (novo): recebe Appointment/Payment/Order Insert/Update, **re-busca a entidade por id** (`GET /v3/appointment/{id}` ou `/v3/order/{id}`) e faz upsert em `shopmonkey_appointment`/`sale`/`order` com `parseNote`. Detecta o tipo pelos campos (startDate/color = appointment; orderId = payment; paid/totalCostCents = order).
- **Webhook registrado:** "(ProCar AI) Loja tempo real", triggers `AppointmentInsert`, `AppointmentUpdate`, `PaymentInsert`, `OrderInsert`.
- **Segurança:** `SHOPMONKEY_WEBHOOK_SECRET` (`?s=`).
- **Limpeza:** removido o webhook stale antigo; 3 webhooks legados da Atlas/n8n seguem desabilitados (quebrados, não são nossos).

### 8.3 n8n — inalterado
O n8n (VPS) segue recebendo o `add_message` (fluxo de mensagens) — **não foi editado**. Para mudança de lead, o webhook **direto** Kommo→edge function é mais robusto que rotear pelo n8n. Containers verificados de pé (worker/webhook/editor/redis + traefik).

---

## 9. Inventário técnico

### Migrations (aplicadas no barssss + versionadas)
```
20260624120000_shopmonkey_appointment_note_tokens.sql   (5 colunas + índices)
20260624130000_get_appointment_origin_kpis.sql           (K)
20260624140000_get_pipeline_loss_kpis.sql                (N, + fin_shopmonkey, + loss_reason/distancia)
20260624150000_get_seller_upsell_kpis.sql                (M)
20260624160000_get_followup_calls_by_seller.sql          (I)
20260624170000_get_ongoing_conversations_kpis.sql        (B)
20260624180000_get_organic_interested_kpis.sql           (D, regex i.{0,2}m interested)
20260624190000_absoluto_pipeline.sql                     (G: lead_db.is_absoluto + get_absoluto_kpis)
20260625120000_lead_db_loss_reason.sql                   (N #50)
20260625130000_get_integration_call_lead_ids.sql         (backfill tag Twilio)
```

### Colunas novas
- `shopmonkey_appointment`: `upsell text[]`, `financing text[]`, `is_referral bool`, `is_absoluto bool`, `phone_active_booking bool`.
- `lead_db`: `is_absoluto bool`, `loss_reason text`.

### Edge functions
| Função | Mudança |
|---|---|
| `_shared/parse-note.ts` | novos tokens (upsell/financing/referral/absoluto/phone-active) |
| `sync-shopmonkey` | grava tokens do note |
| `ingest-interaction` | detecta absoluto na msg + escreve tag Kommo + modo `backfill_absoluto` |
| `ingest-call` | tag "Ligação Twilio" no auto-create + modo `backfill_twilio_tag` |
| `sync-kommo` | lê tag absoluto (2c) + `loss_reason` (2d, `with=loss_reason`) |
| **`kommo-lead-webhook`** | NOVO — tempo real de mudança de lead |
| **`shopmonkey-webhook`** | NOVO — tempo real de agendamento/venda |

### Frontend
`KPICard.tsx` (tone), `LeadsKPICards.tsx` (K), `PipelineLossCards.tsx`*, `OngoingConversationsCards.tsx`*, `OrganicInterestedCards.tsx`*, `AbsolutoCards.tsx`*, `SellersRankingTable.tsx` (chips J/I/M), `LeadsStatusChart.tsx` (cor), `Dashboard.tsx` (fiação + etapa de ligação), `Leads.tsx` (export), `lib/export.ts`*. (* = arquivo novo)

### Webhooks ativos (Kommo, conta `infoprocarsoundsecuritycom`)
1. `add_message` → n8n (mensagens) — intacto.
2. `update_lead` → ATLAS (ligações).
3. `add_lead`+`status_lead` → `kommo-lead-webhook?s=…` — **novo, tempo real**.

### Webhooks ativos (ShopMonkey)
- "(ProCar AI) Loja tempo real": `AppointmentInsert/Update`, `PaymentInsert`, `OrderInsert` → `shopmonkey-webhook?s=…`.

### Secrets novos (Supabase)
- `KOMMO_WEBHOOK_SECRET`, `SHOPMONKEY_WEBHOOK_SECRET`. (Os valores estão embutidos na URL de destino de cada webhook — visíveis em `{list_webhooks}` — e guardados no scratchpad da sessão.)

### Crons existentes (UTC) — rede de segurança
`sync-kommo-hourly` :07 (days=2) · `sync-shopmonkey-hourly` :22 · `reconcile-kommo-hourly` :12 · diários: reconcile 6:50, vendedor→Kommo 6:40, dedup 6:40, google-reviews 7:15, idioma 7:40, scan-services 7:55.

---

## 10. Latência — o que é tempo real vs lote

**Tempo real (na hora):**
- Etapa do lead + motivo de perda + novo lead → `kommo-lead-webhook`.
- Mensagens / "I'm interested" / absoluto / 1ª resposta → `ingest-interaction`.
- Ligações + tag "Ligação Twilio" → `ingest-call`.
- Agendamentos, vendas, K, J, M, N-financiamento, orçamentos → `shopmonkey-webhook`.

**Quase tempo real (por natureza/custo):** métricas de **IA** (score, objeções, upsell-IA) — `analyze-lead` dispara em marcos de mensagem (5/10/20…).

**Lote de propósito:** Google Reviews + mix de serviços (cron diário); reconciliação (snapshot). O `sync-kommo`/`sync-shopmonkey` horários continuam como **rede de segurança** caso um webhook falhe.

---

## 11. Pendências / dependências externas

- **Upsell por nota (M):** o card popula sozinho quando a equipe escrever `(UPSELL: item1, item2)` no note do ShopMonkey (hoje 0). O fallback de IA (`has_upsell`) já mostra um número de referência.
- **`update_lead` no webhook Kommo:** não assinado de propósito (ruidoso). Edição de campo sem trocar de etapa cai no sync horário. Como motivo de perda só é definido ao mover para perdido, `status_lead` já cobre.
- **Webhooks legados da Atlas/n8n no ShopMonkey:** desabilitados e quebrados (404/500) — limpar na UI do ShopMonkey se quiser.
- **Refresh do front:** o banco atualiza na hora; o dashboard reflete quando a tela refaz a consulta (React Query revalida no foco/refresh).

---

*Documento técnico interno — Pro Car Sound & Security · BI/Dev.*
