# Auditoria do BI — status de resolução (todos os pontos do PDF)

Rastreio de **todos** os itens da auditoria (`Auditoria_Dashboard_BI_ProCar.pdf`, 02/06/2026).
Atualizado em 2026-06-06.

**Legenda:** ✅ resolvido · 🔧 em andamento/parcial · 🧱 depende da cura do pipeline (ingestão/reconciliação) · 🆕 feature nova a desenvolver · ❓ precisa decisão de produto · ⏳ depende dos scripts de IA (vocês subiram)

## 1. Transversais
- ✅ **Moeda USD** (PR #2) — upsell já em escala dólar (~$222K, era ">$1M").
- ✅ **Tooltips em todos os gráficos** (PR #4) + **Fonte/racional em todos os KPIs** (PR #5).
- ✅ **Filtro de período + atalho "Hoje"/"Ontem" + custom range** em todas as abas, incl. Canais/Chamadas (PR #3).
- 🔧 **Confiabilidade dos dados** — diagnóstico (PR #5) + ferramenta de reconciliação Kommo (PR #6) + **sync ShopMonkey** (PR #8, este). Gap medido: dashboard ≈ 85–90% da Kommo (7d: 600 Kommo × 509 BI). Cura do pipeline (sync Kommo→lead_db + ingest upsert) = próxima fase.
- 🆕 **Destrinchar** (segmentação por produto, etnia, idioma, geografia/zip) — eixo transversal; será incorporado nas features novas.

## 2. Visão Geral
- 🧱 Leads por Língua · Leads novos 24h (por canal) · Leads com cotação · Leads novos por período — divergem por volume (pipeline) + revisão de normalização.
- ❓🧱 **Taxa de conversão** — depende de definir "conversão = venda ganha **ou** agendamento" (ver Agendamento vs Venda) + base completa.
- ✅🧱 Valor médio cotado — moeda corrigida; cálculo/dados a revisar.
- 🔧 Tempo mediano 1ª resposta — revisar cálculo contra dado real.
- 🔧 **Walk-in (presenciais)** — hoje subcontado; **detector por texto** (cheguei/estou na loja/ya llegué) a implementar no analyze-lead + backfill.
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
- ✅ "Status de venda" (layout corrigido, PR #7).
- 🧱 Painel-resumo · Detalhe do vendedor · Timeline · Top objeções (dados).
- 🆕 **Cadastro e segmentação de TODOS os vendedores** (Ricardo, Henrique, Matheus, Gabriel…).

## 6. Canais
- 🧱 Leads recebidos por canal · Volumes por canal (telefone OK; demais divergem).
- 🆕 Destrinchar: etnias/idiomas por canal, vendedor × grupo étnico.

## 7. Chamadas
- ✅ Volume · Duração · Objeções/contornadas/oferta · Categorias · Volume&score (validados).
- ⏳ Score e distribuição (scripts).
- 🆕 Compliance médio (incluir) · Chamadas por hora · Acompanhamento por vendedor (ativo/passivo, quem converte follow-up).

## 8. Anúncios (Meta/Google)
- 🧱 Reconciliar com as exportações oficiais de 90 dias; entender a fonte da automação.

## 9. Lacunas / novos requisitos
- 🔧 **Agendamento vs Venda** — sync ShopMonkey (PR #8) já traz os 2 sinais separados (regra: green=agendamento; order pago=venda). Falta a **UI** (indicadores + receptivo/ativo).
- 🆕 Orgânico vs Pago · Canal E-mail · Canal Indicação (referral) · Ligações por vendedor · Inteligência de produtos/serviços · Cancelamentos · Leads perdidos (motivos + scam + zip) · Financiamentos (Snap) · Reviews.

---
**Próximas fases (ordem sugerida):** (1) UI das tabelas ShopMonkey (Vendas/Agendamentos) → fecha "Vendas=0" e "Agendamento×Venda"; (2) cura do pipeline (volumes batem com Kommo); (3) walk-in por texto; (4) features novas, priorizadas com a equipe.
