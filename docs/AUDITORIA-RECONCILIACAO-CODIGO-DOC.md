# Reconciliação Código × Documento — Auditoria Pro Car

> **Elaborado por** Marcos Venâncio — Responsável técnico (BI / Desenvolvimento do dashboard)
> **Data** 7 de junho de 2026
> **Escopo** Verificar, ponto a ponto, se o que o documento de resposta (`AUDITORIA-RESPOSTA-ProCar.md`) afirma como **FUNCIONAL** está de fato sustentado pelo **código em produção** (`main`), corrigir o que não estiver, e deixar registrado o que ainda depende de deploy, de convergência da base, da cobertura de IA ou de dados que só existem na origem.

Documento interno e confidencial. Serve de trilha para a auditoria real.

---

## 1. Inventário — o que está / não está em produção

| Camada | Estado em 07/06/2026 |
|---|---|
| **Código mergeado** | PRs **#1–#43 todos MERGED**; `main` == `origin/main`. O alvo da auditoria é o `main` HEAD. |
| **Código não-mergeado** | Nenhum, exceto esta rodada de correções (PR nova `fix/conversao-tempo-real-e-doc-honesto`). |
| **PR aberta anterior** | **#32** (`docs/auditoria-resposta-procar`) — docs-only, com versão **antiga/exagerada** do `.md`. Substituída por esta rodada. |
| **Worktree paralelo** | `.claude/worktrees/workspace` — limpo, em commit já mergeado. Irrelevante. |
| **PDF** | `AUDITORIA-RESPOSTA-ProCar.pdf` — **desatualizado** (gerado da versão exagerada). Precisa ser regerado do `.md` honesto. |

---

## 2. Metodologia da verificação

Verificação **adversarial** (15 agentes em paralelo), cada um instruído a **tentar refutar** uma afirmação "FUNCIONAL" do documento contra o código real do `main` (migrations, RPCs, componentes, crons). Cada item recebeu um veredito:

- **CONFIRMADO** — o código sustenta a afirmação ponta a ponta.
- **PARCIAL** — o mecanismo existe, mas com ressalva real.
- **SUPERDIMENSIONADO** — a afirmação diz mais do que o código entrega.
- **DEPENDE DE DADO VIVO** — só se confirma consultando o banco (barssss); código não prova.

**Resultado dos 13 itens que a última sessão marcou FUNCIONAL:** 2 confirmados · 7 parciais · 4 superdimensionados · 8 dependiam de estado de dado.

---

## 3. Veredito por item (e status corrigido)

| Item | Veredito da verificação | Status corrigido | Por quê |
|---|---|---|---|
| Detalhe do vendedor (metas) | CONFIRMADO | **FUNCIONAL** | Compara com a meta configurada; tela de metas existe e é condicional. |
| Avaliações Google (reviews) | CONFIRMADO | **~90%** | Card + sync + cron no `main`; falta só a API key. |
| Painel-resumo do vendedor | PARCIAL | **FUNCIONAL** (texto suavizado) | Métricas e JOIN reais (Kommo+ShopMonkey, atribuição ~93%). Removido "já validada nos dados". |
| Timeline dos leads | PARCIAL | **FUNCIONAL** (com ressalva) | Ancoragem real ao card; universo = subconjunto de chat auditado (explicitado). |
| Confiabilidade dos dados | PARCIAL | **EM AJUSTE** | Fonte/racional + card de reconciliação existem; falta **dedup chat↔Kommo por telefone**. |
| Conversão por cotação | PARCIAL | **EM AJUSTE** | Venda-only + USD + período OK; população (chat-subset) ≠ do título (base completa). |
| Taxa de objeções contornadas | PARCIAL | **EM AJUSTE** | Base/fórmula/amostra expostas; amostra = subconjunto auditado pela IA. |
| Distribuição por hora | PARCIAL | **EM AJUSTE** | Overlay real; série de chat depende da convergência da base. |
| Leads frios sem follow-up | PARCIAL | **EM AJUSTE** | Varredura sem limite + 4 KPIs OK; cobertura depende da IA; KPIs ainda não filtram período. |
| Distribuição de compliance | SUPERDIMENSIONADO | **EM AJUSTE** | "Todos auditados" falso — IA roda por marcos [5,10,20,30,40]; cobertura ~37%. |
| Conversão por tempo de resposta | SUPERDIMENSIONADO | **EM AJUSTE → FUNCIONAL após deploy** | Tempo era proxy 1ª→3ª msg; **corrigido para real cliente→agente** (migration 20260606320000). |
| Leads de hoje | SUPERDIMENSIONADO | **EM AJUSTE** | Conta a base completa, não "só chat"; sem dedup pode duplicar. |
| Top objeções do vendedor | SUPERDIMENSIONADO | **EM AJUSTE** | Reflete o subconjunto auditado, não "o conjunto completo do período". |
| Volumes por canal (comparativo) | (já era EM AJUSTE) | **EM AJUSTE** | Falta vendedor × canal (bloqueio de atribuição) + migrar colunas do comparativo p/ `source_id`. |

**Tally da Seção 1 após a correção:** ~38 FUNCIONAL · **11 EM AJUSTE** · 4 PENDENTE (SCRIPTS).

---

## 4. Correções aplicadas nesta rodada

### Código
- **`supabase/migrations/20260606320000_fix_conversion_response_time_real.sql`** (novo) — `get_conversion_by_response_time` passa a usar o **tempo real de 1ª resposta (cliente → agente)**, a mesma regra do `get_leads_kpis` (`20260606200000`) e da aba Canais, em vez do proxy 1ª→3ª interação que a auditoria marcou "irreal". Mantém: conversão = só venda (ganha/won), filtro de IA e amostra de chat (≥3 msgs).
- **`LeadsConversionByResponseTimeChart.tsx`** — tooltip: tempo "1ª → 3ª mensagem" → "1ª mensagem do cliente → 1ª resposta do agente"; conversão "venda **ou** agendamento" → "venda (ganha)".
- **`LeadsConversionByQuoteChart.tsx`** — tooltip: conversão "venda **ou** agendamento" → "venda (ganha)".
- **`LeadsKPICards.tsx`** e **`Today.tsx`** — removido o rótulo falso "só WhatsApp/chat · menor que o Kommo" dos KPIs **Leads Novos (24h)** e **Novos leads (hoje)**, que já contam a base completa → "base do painel (Kommo + chat)".

> `tsc --noEmit` passa (exit 0).

### Documento (`AUDITORIA-RESPOSTA-ProCar.md`)
- 9 itens rebaixados de FUNCIONAL → **EM AJUSTE** com uma **"Ressalva honesta"** em cada um.
- Removidas de todo o doc as afirmações de dado não comprováveis: **"todos os leads auditados"**, **"base convergida"**, **"~88%"**.
- Legenda de EM AJUSTE e **Próximos passos** reescritos (deploy → dedup → cobertura de IA).

---

## 5. Depois do merge + deploy desta rodada: o que fica funcional × o que continua bloqueado

### ✅ Vira FUNCIONAL de fato
- **Conversão por tempo de resposta** — a migration torna o tempo real cliente→agente em produção (único item de status que flipa).
- Tooltips de conversão e rótulos 24h/hoje passam a refletir o que o código calcula.

### 🔧 Continua EM AJUSTE — depende de **engenharia nossa** ainda não feita
- **Confiabilidade / Leads de hoje / Distribuição por hora** → **dedup chat↔Kommo por telefone** (a captura do telefone já foi feita no PR #36; falta o *collapse* dos registros repetidos).
- **Volumes por canal** → migrar as colunas de volume/conversão do comparativo para a base por `source_id`.
- **Leads frios (KPIs)** → passar `date_from`/`date_to` ao `get_cold_audit_kpis` (ajuste pequeno).

### ⏳ Continua EM AJUSTE — depende da **cobertura do pipeline de IA**
- **Compliance / Objeções contornadas / Top objeções / Leads frios (cobertura)** → hoje a IA analisa só por marcos da conversa (~37% da base). Para "ampliar ao máximo" de verdade é preciso um job que varra toda a base de chat **e** os scripts de IA da Pro Car.

### ⛔ Continua bloqueado — depende de **dado que não existe na origem**
- **Vendedor × canal**, **ligações por vendedor**, **objeções/conversão de chat por vendedor** → o vendedor individual só é confiável no ShopMonkey (~93%); na Kommo/chat o responsável é genérico em ~99%. Exige atribuir o vendedor na origem (Kommo) ou linkar lead↔ShopMonkey por telefone.

### 🟠 Continua PENDENTE (SCRIPTS) — depende 100% da Pro Car
- Uso de estratégia de venda · Score médio (Hoje) · Leads quentes sem resposta (score) · Score/distribuição (Chamadas).

### 🟡 Pós-entrega
- **Meta/Google Ads** → reconciliação com as exportações oficiais de 90 dias.

---

## 6. Conclusão honesta

A engenharia de base foi construída e está no `main`. **Merge + deploy desta rodada NÃO deixa "tudo funcional"** — torna 1 indicador realmente correto (conversão por tempo) e alinha rótulos/tooltips. Os 10 itens restantes em "EM AJUSTE" continuam assim porque dependem de três frentes distintas: **(1)** convergência/dedup da base, **(2)** cobertura do pipeline de IA, **(3)** atribuição de vendedor na origem — sendo que (2) e parte de (3) dependem da própria Pro Car. O documento de resposta agora reflete isso sem exagero.
