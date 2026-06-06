# Auditoria do BI — status de resolução (todos os pontos do PDF)

Rastreio de **todos** os itens da auditoria (`Auditoria_Dashboard_BI_ProCar.pdf`, 02/06/2026).
Atualizado em 2026-06-06.

**Legenda:** ✅ resolvido · 🔧 em andamento/parcial · 🧱 depende da cura do pipeline (ingestão/reconciliação) · 🆕 feature nova a desenvolver · ❓ precisa decisão de produto · ⏳ depende dos scripts de IA (vocês subiram) · ⛔ **bloqueado por dado ausente** (precisa de captura nova, não dá pra fazer com o que existe)

> ### 🔑 Descoberta-chave: atribuição de vendedor
> O vendedor individual **só existe de forma confiável no ShopMonkey** (extraído do texto do agendamento por código puro, `parseNote`, **~93%** de cobertura). Onde isso falha:
> - **Kommo:** `responsible_user` é 100% a conta genérica "Pro Car Sound & Security"; o campo "Vendedor shopmonkey" só tem nome real em **~2%**.
> - **Chat (`lead_db`):** `sales_person_id` é a conta genérica em **~99%**.
> - **Chamadas (`call_db`):** só **22 de 852** linkam a um vendedor real; `type` é sempre `phone` (não há ativo/passivo estruturado).
>
> **Consequência:** todo indicador POR VENDEDOR de chat/chamadas/cruzamentos é não-confiável hoje. A aba Vendedores foi reconstruída sobre a **fonte ShopMonkey** (agendamentos/orçamentos/vendas/receita/walk-in por vendedor — PRs #12/#14). Desbloquear chat/chamadas por vendedor exige **capturar o vendedor na origem** (atribuir individual na Kommo ou linkar lead↔ShopMonkey por telefone — `lead_db` hoje nem guarda telefone).

## 1. Transversais
- ✅ **Moeda USD** (PR #2) — upsell já em escala dólar (~$222K, era ">$1M").
- ✅ **Tooltips em todos os gráficos** (PR #4) + **Fonte/racional em todos os KPIs** (PR #5).
- ✅ **Filtro de período + atalho "Hoje"/"Ontem" + custom range** em todas as abas, incl. Canais/Chamadas (PR #3).
- ✅🔧 **Confiabilidade dos dados** — diagnóstico (PR #5) + reconciliação Kommo (PR #6) + **sync ShopMonkey** (PR #8) + **sync Kommo→lead_db** (PR #11, insert-only, +1.086 leads ausentes em 30d, incl. 568 vendas) + **cron horário** `sync-kommo`/`sync-shopmonkey` (PR #13, rumo a aposentar o n8n). Gap de volume fechado (7d passou de 508→710 ≥ Kommo). Falta: enriquecer os espelhos com IA (opcional) e migrar a ingestão de chat para código puro.
- 🆕 **Destrinchar** (segmentação por produto e idioma) — eixo transversal; será incorporado nas features novas.

## 2. Visão Geral
- 🧱 Leads por Língua · Leads novos 24h (por canal) · Leads com cotação · Leads novos por período — divergem por volume (pipeline) + revisão de normalização.
- ❓🧱 **Taxa de conversão** — depende de definir "conversão = venda ganha **ou** agendamento" (ver Agendamento vs Venda) + base completa.
- ✅🧱 Valor médio cotado — moeda corrigida; cálculo/dados a revisar.
- 🔧 Tempo mediano 1ª resposta — revisar cálculo contra dado real.
- ✅ **Walk-in (presenciais)** — religado à fonte real: o KPI da Visão Geral agora conta `shopmonkey_appointment.walk_in` (do *note* do agendamento, via `parseNote`) por `start_date` (migração `20260606260000`). 7d passou de **0 → 18** (inclui o sábado 30/05 com 7). Detector por texto no chat (cheguei/ya llegué) fica como reforço opcional futuro.
- ✅ Valor de upsell (USD). · ❓ Oportunidade de upsell (qtd) — definir critério.
- ✅ Leads por status · ✅ Ranking de objeções (validados).
- 🆕 Temperatura · Sentimento · **Top 5 Produtos → inteligência de produtos** (ranking global + share + segmentação).
- 🧱 Compliance · Conversão por tempo de resposta · Conversão por cotação · Taxa de objeções contornadas (cobertura/amostra).
- ⏳ Uso de estratégia de venda (scripts).

## 3. Hoje
- ✅ Nº de mensagens · Nº de chamadas (validados).
- ✅ Canais de hoje → barras · Sentimento de hoje → barras (PR #7).
- 🔧 **Vendas (hoje) = 0** → resolvido pela **sync ShopMonkey** (PR #8): 7d = **116 vendas / ~$49K**.
- 🧱 Leads de hoje · Distribuição por hora (double-check).
- ⏳ Score médio · Leads quentes sem resposta (score) — scripts.

## 4. Leads
- 🧱 Leads frios sem follow-up / reativáveis (cobertura de auditoria).
- ✅ Valor potencial de upsell (USD).

## 5. Vendedores
- ✅ **Cadastro e segmentação de TODOS os vendedores** (Ricardo, Gabriel, Henrique, Matheus, JP…) via **ShopMonkey** — agendamentos/walk-ins/**orçamentos**/vendas/receita por vendedor (PRs #12/#14). Resolve "só o Ricardo cadastrado".
- ✅ **Cotações reais** — "Cotações=1" virou **orçamentos do ShopMonkey** por vendedor (ex.: Ricardo 95) (PR #14).
- ✅ **"Status de venda"** — layout legível (rótulos truncados + tooltip) **e** dados normalizados (proporções reais) (PR #13).
- ✅ **Resumo × detalhe coerentes** — gráficos do detalhe agora usam a mesma regra de "ganho" do RPC (PR #13). · ✅ **Meta** usa o alvo configurado (fim do "15% com meta 10%"). · ✅ Timeline ancorada no total · ✅ "Novos 24h" rotulado como janela móvel.
- ⛔ **Objeções/cotações/conversão de CHAT por vendedor** — não-confiáveis (sales_person_id genérico, ver Descoberta-chave). Os números reais por vendedor vêm do ShopMonkey acima.

## 6. Canais
- 🧱 Leads recebidos por canal · Volumes por canal (telefone OK; demais divergem) — melhora com o backfill Kommo (PR #11).
- ⛔ **idioma × vendedor** — bloqueado (atribuição de vendedor genérica). · 🔧 idioma/canal SEM vendedor é viável (lead_language 52%, channel 100%).

## 7. Chamadas
- ✅ Volume · Duração · Objeções/contornadas/oferta · Categorias · Volume&score (validados).
- ⏳ Score e distribuição (scripts).
- ⛔ **Acompanhamento por vendedor (ativo/passivo, follow-up)** — bloqueado: só 22/852 chamadas linkam a vendedor e `type` é sempre `phone` (sem ativo/passivo). Viável o agregado SEM vendedor (`ai_call_analysis` tem objeção/oferta/ancoragem/score). · 🆕 Compliance médio · Chamadas por hora.

## 8. Anúncios (Meta/Google)
- 🧱 Reconciliar com as exportações oficiais de 90 dias; entender a fonte da automação.

## 9. Lacunas / novos requisitos
- ✅ **Agendamento vs Venda** — separados e na **UI** da aba Vendedores (green=agendamento; order pago=venda; order criado=orçamento) (PRs #12/#14). Falta receptivo/ativo (depende de atribuição de chamada).
- ⛔ **Ligações por vendedor** — bloqueado (ver Descoberta-chave). · 🆕 Orgânico vs Pago · Canal E-mail/Indicação (já mapeados na sync-kommo) · Inteligência de produtos/serviços (`services_detected` 70%, viável) · Cancelamentos · Leads perdidos · Financiamentos (Snap) · Reviews.

---
**Próximas fases (ordem sugerida):** (1) **Desbloquear vendedor** — capturar o vendedor individual na origem (Kommo) ou linkar lead↔ShopMonkey por telefone — destrava conversão/objeções/chamadas/cruzamentos por vendedor de uma vez; (2) **Inteligência de produtos** (`services_detected`/`upsell_products`, dados existem); (3) walk-in por texto no chat (reforço opcional — a fonte ShopMonkey já cobre o KPI); (4) agregados de chamadas (sem vendedor) via `ai_call_analysis`; (5) features novas priorizadas com a equipe.
