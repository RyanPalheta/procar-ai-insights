# Diagnóstico de Confiabilidade dos Dados — Pro Car AI Insights

**Data:** 2026-06-05 · **Escopo:** por que os volumes de leads do dashboard divergem da base real (Kommo) e o que fazer.

> **Conclusão central (TL;DR):** o dashboard **não é uma cópia da Kommo**. O `lead_db` (banco que o BI lê) contém **apenas os leads originados de conversas de chat que foram auditados pela IA**. A Kommo, além desses, recebe leads de **agendamentos do Shopmonkey**, **pagamentos**, **telefone** e **entrada manual** — que **nunca entram no `lead_db`**. Portanto a divergência de volume é **estrutural e esperada** na arquitetura atual, não um bug pontual. Os tooltips "?" que adicionamos documentam *como* cada número é calculado (transparência), mas **não corrigem a base**. Confiabilidade exige fechar a linhagem (reconciliar e/ou unificar a fonte).

---

## 1. Linhagem dos dados (de onde vem cada coisa)

Existem **dois pipelines independentes** alimentando a Kommo, e o dashboard só enxerga **um** deles.

```
                        ┌─────────────────────────────────────────────┐
   Conversas de chat    │ Pipeline A — CHAT / IA (alimenta o dashboard)│
   (WhatsApp/IG/FB)  ─► │ ingest-interaction ─► invoca analyze-lead    │
                        │ ingest-lead ─► lead_db (Supabase)            │ ─► DASHBOARD lê aqui
                        │ analyze-lead grava IA ─► sync-to-kommo ──────┼──┐
                        └─────────────────────────────────────────────┘  │
                                                                          ▼
   Agendamentos         ┌─────────────────────────────────────────────┐  KOMMO
   Shopmonkey      ───► │ Pipeline B — procar-shopmonkey-sync          │  (CRM / base real)
   (color=green)        │ filtra color==green ─► Gemini parse notes ─► │ ─► cria/atualiza lead
                        │ upsert lead na Kommo + paga ─► lead GANHO    │     (NÃO toca o lead_db)
                        └─────────────────────────────────────────────┘
   Telefone / manual ─────────────────────────────────────────────────► cria lead direto na Kommo
```

- **Pipeline A (chat/IA)** — alimenta o **`lead_db`**:
  - `ingest-interaction` recebe mensagens dos canais e, ao receber, **invoca `analyze-lead`** (`supabase/functions/ingest-interaction/index.ts:240`). Ou seja, **a auditoria da IA só acontece para leads que têm conversa de chat**.
  - `ingest-lead` insere o lead no `lead_db` (`supabase/functions/ingest-lead/index.ts:108-112`).
  - A análise da IA é empurrada de volta para a Kommo por `sync-to-kommo`.
- **Pipeline B (Shopmonkey)** — `C:\Users\venan\OneDrive\Desktop\ProCar\procar-shopmonkey-sync`:
  - Serviço Fastify **sem banco**. Recebe webhook de agendamento, **filtra `color == "green"`** (`src/domain/pipeline.ts:34`), parseia notas via Gemini, e **faz upsert do lead na Kommo** (busca contato por telefone → cria/atualiza). **Não tem nenhuma referência a Supabase/`lead_db`/`ingest`** — alimenta **só a Kommo**.
  - O endpoint `/payments` (`src/domain/payment-pipeline.ts`) cria **leads já GANHOS** na Kommo a partir de pagamentos do Shopmonkey.
- **Telefone / entrada manual** — criam leads direto na Kommo, sem passar por nenhum dos dois.

**Resultado:** `lead_db ⊊ Kommo`. O dashboard mostra um **subconjunto** (leads de chat auditados). Comparar o "Total de Leads" do BI com o total da Kommo é comparar coisas diferentes.

### 1.1 Confirmação no servidor (n8n) — verificado, não inferido

Inspeção do servidor ProCar (`root@5.181.218.168`, stack Docker Swarm com **Supabase self-hosted + n8n (modo queue) + Evolution API (WhatsApp) + procar-shopmonkey-sync**) e do banco do n8n (`n8n_queue`, tabela `workflow_entity`):

- **A ingestão para o `lead_db` é disparada por MENSAGEM de WhatsApp/chat**, não por uma lista de leads da Kommo. Os workflows **ATIVOS** que chamam o `ingest-lead`/`ingest-interaction` têm gatilho de **webhook de mensagem** e **chatTrigger**:
  - `Webhook -> Dashboard Ingest (Message sent)` — gatilho `n8n-nodes-base.webhook` (mensagem enviada via Evolution/WhatsApp) → classifica → `executeWorkflow` → ingest.
  - `Ingest_Dash_client` / `Ingest_Dash_sales` — `executeWorkflowTrigger` / `chatTrigger` (agente de IA).
  - `ATLAS - Ingestao de Chamadas` — `scheduleTrigger` (cron) para **chamadas**.
- **O workflow que puxaria todos os leads da Kommo existe, mas está DESLIGADO:** `Retrieve leads generated in the past 3 months` = **off**. Também estão **off**: `Polling Kommo - FB/IG Agent Messages`, `Update leads with ShopMonkey data`, `Clean duplicates by selecting pipeline & status`.

**Conclusão verificada:** não há, hoje, nenhum fluxo ativo que sincronize *todos* os leads da Kommo para o `lead_db`. Só entra quem teve conversa de WhatsApp/chat. A causa **A** está confirmada na origem — e o caminho de correção (P0.2/P2) já existe como workflow, apenas desativado.

---

## 2. Causas da divergência (com evidência e impacto)

| # | Causa | Evidência | Indicadores afetados |
|---|-------|-----------|----------------------|
| **A** | **Dois pipelines; o BI só vê o de chat.** Leads de Shopmonkey/telefone/manual entram na Kommo mas **nunca** no `lead_db`. | `procar-shopmonkey-sync` não referencia Supabase/ingest; `ingest-lead` só é chamado pelo fluxo de chat. | **Todos os volumes** (Total de Leads, por canal, por status, conversão, receita). Subcontagem sistêmica. |
| **B** | **Filtro "auditado pela IA".** Vários números contam só `last_ai_update IS NOT NULL`, e a auditoria só dispara com **interação de chat**. | `get_leads_kpis` (`total_audited` = `COUNT(*) WHERE last_ai_update IS NOT NULL`), trigger em `ingest-interaction:240`. | "Total de Leads (auditados)", conversão, score médio, compliance, tempo de resposta. |
| **C** | **`ingest-lead` é insere-uma-vez (push-only).** Se o `lead_id` já existe, retorna **409 e ignora** (não atualiza). Sem backfill, sem outras fontes. | `supabase/functions/ingest-lead/index.ts:75-87` (409 "Lead already exists"). | Status/preço/ganho **desatualizados** → conversão e receita defasadas. |
| **D** | **Filtros do Pipeline B.** Agendamento **não-green** → `skipped_color`; lead já **ganho** → `skipped_won`. Nem toda atividade do Shopmonkey vira lead na Kommo. | `pipeline.ts:34` (`skipped_color`), `pipeline.ts:68-69` (`skipped_won`). | Volume de agendamentos/leads vindos do Shopmonkey. |
| **E** | **Janela de 50 dias com webhook quebrado (25/03→14/05/2026).** O webhook do Shopmonkey apontava para um n8n que retornava **HTTP 500**; todo `AppointmentInsert/Update` foi **silenciosamente descartado**. 18 agendamentos green perdidos, **16 backfilled, 2 não** (Kevin/Proposta pulado). | `ProCar/CLAUDE.md` "Recent decisions" (2026-05-14). | Histórico de leads/agendamentos nesse período — buraco real. |
| **F** | **Chave do Gemini expirada.** O parse de notas caiu em **fallback** (`walkIn=false`, `seller=""`) para os agendamentos processados durante a falha. | `ProCar/CLAUDE.md` (2026-05-14/20): "notes → walkIn=false, seller=''". | **Leads presenciais (walking)** e **atribuição de vendedor** contaminados. |
| **G** | **Pagamentos criam leads GANHOS direto na Kommo.** Receita/vendas que o `lead_db` não enxerga (a menos que o cliente também tenha tido chat). | `payment-pipeline.ts` (`created_new_lead_won`, `cloned_to_won_and_moved_to_carteira`). | Receita, taxa de conversão, vendas por canal. |
| **H** | **Exclusões/normalização no BI.** Status `nda/test/teste` são descartados; canais e sentimento são normalizados. | `Dashboard.tsx normalizeStatus/normalizeChannel/normalizeSentiment`. | Distribuições por status/canal/sentimento. |
| **I** | **Sem reconciliação.** Nada compara `lead_db` × Kommo, então o gap fica **invisível e não-quantificado**. | Não existe função de pull/contagem da Kommo no dashboard. | Confiança geral — não dá pra saber o tamanho do erro. |

---

## 3. O que os tooltips "?" já resolvem (e o que não)

- **Resolvem (transparência):** cada gráfico (e, na sequência, cada KPI) passa a mostrar **Fonte** + **racional de cálculo**. Isso atende o pedido "documentar a fonte e o racional de cada indicador". O racional **já aparece**.
- **Não resolvem (confiabilidade):** documentar a fórmula de um número que parte de uma base incompleta **não torna o número correto**. As causas A–I estão no **pipeline de dados**, não na apresentação.

---

## 4. Plano de correção (priorizado)

### P0 — Tornar o gap visível e honesto (rápido, alto impacto)
1. **Rótulos explícitos no BI:** marcar cada indicador como **"leads auditados pela IA"** vs **"total (Kommo)"**, para ninguém comparar coisas diferentes. *(item já aprovado)*
2. **Reconciliação Kommo × `lead_db`:** um job que puxa **contagens** da Kommo (o token da API **já existe** em `sync-to-kommo` no dashboard e em `procar-shopmonkey-sync`) e compara com o `lead_db` por **período e canal**. Saída: "Kommo tem N, o BI tem M, gap = N−M e onde está". Transforma "os dados estão errados" em "faltam X leads de telefone no período Y". **Ponto de partida concreto:** já existe um workflow n8n **desativado** — `Retrieve leads generated in the past 3 months` — que faz exatamente o pull de leads da Kommo; reativá-lo/reescrevê-lo (apontando para `ingest-lead` como upsert) é o caminho mais curto.

### P1 — Fechar as fugas conhecidas
3. **`ingest-lead` virar upsert** (refletir updates de status/preço/ganho) em vez de 409.
4. **Renovar a chave do Gemini** e **backfillar** os 2 agendamentos green não recuperados (causa E/F).
5. **Sincronizar pagamentos/ganhos** do Shopmonkey para o `lead_db` (ou marcar a receita que vem por fora).

### P2 — Unificar a fonte da verdade (estrutural)
6. Decidir a **Kommo como fonte única** e reconstruir o `lead_db` como **espelho fiel** dela (sync Kommo→Supabase puxando **todos** os leads), com a IA como **camada de enriquecimento** por cima — não como porta de entrada. Assim "volume do BI" = "volume da Kommo" por construção, e os indicadores derivados passam a ser confiáveis.

---

## 5. Por indicador — fonte e risco (resumo)

| Indicador | Fonte | Risco de divergência |
|-----------|-------|----------------------|
| Total de Leads / Novos | `lead_db` (chat auditado) | **Alto** — não inclui Shopmonkey/telefone/manual (A,B). |
| Taxa de Conversão | `lead_db` `sales_status` | **Alto** — base parcial + status defasado + ganhos via pagamento fora (A,C,G). |
| Receita (vendas) | `lead_db` `lead_price` de ganhos | **Alto** — receita de pagamentos Shopmonkey não entra (G). |
| Leads por Canal | `lead_db` `channel` | **Alto** — telefone/Shopmonkey sub-representados (A). |
| Leads Presenciais (walking) | `lead_db` `is_walking` | **Médio/Alto** — contaminado pelo fallback do Gemini (F). |
| Vendedores | `lead_db` `sales_person_id` | **Médio/Alto** — atribuição contaminada (F) + base parcial. |
| Score / Sentimento / Objeções / Compliance | IA sobre `lead_db` | **Médio** — confiável *para os leads auditados*, mas é subconjunto (B). |
| Métricas de Anúncios (Meta/Google) | API Meta/Google | **Baixo** — vem direto da plataforma, não passa pela Kommo. |
| Chamadas | `call_db` (Twilio) | **Baixo/Médio** — independente da Kommo; confiável para chamadas registradas. |

---

*Próximos passos imediatos deste PR: (P0.1) rótulos explícitos nos indicadores e (documentação) estender o "?" Fonte+racional aos KPIs numéricos. A reconciliação (P0.2) e os itens P1/P2 dependem de acesso à API da Kommo e de decisão de produto.*
