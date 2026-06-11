# Segunda Auditoria (Atlas) — Diagnóstico Aprofundado e Resposta

**Data:** 11/06/2026 · **Elaborado por:** Marcos Venâncio
**Insumos:** PDF "Segunda Auditoria do Dashboard - Atlas" (17 itens) + 5 capturas com legendas (WhatsApp Vinicius ProCar, 10/06) · verificação direta no banco de produção (`barssss`/DASHBOARD_PROCAR) e no código.

---

## 1. Contexto decisivo: a queda da VPS (07–10/06)

A VPS que roda o **n8n + Evolution API** (agente de IA do WhatsApp + ponte de ingestão do chat para o painel) ficou fora do ar por ~3 dias com CPU estourada. Foi feito upgrade e voltou ao normal (~12% de CPU). **A validação da auditoria aconteceu em 10/06, em cima exatamente da janela do buraco.**

### O que o banco mostra, por dia (baseline ≈ 01–06/06)

| Dia | Leads novos | Mensagens (chat) | Chamadas | Análises de IA executadas |
|---|---|---|---|---|
| 01–06/06 (baseline/dia) | 88–126 | 501–817 | 32–41 | 49–73 |
| **07/06 (dom)** | 51 | **314** | **1** | **17** |
| **08/06** | 53 | **0** | **0** | **1** |
| **09/06** | 46 | **174** | **0** | **12** |
| 10/06 (volta) | 65 | 744 | 32 | 69 |

### O que isso explica (e o que não explica)

- **Não afetado:** os crons ficam na nuvem (Supabase), não na VPS. `sync-kommo` (horário) e `sync-shopmonkey` (horário) rodaram normalmente — 124 execuções com sucesso desde 06/06. **A base de leads ficou completa**: reconciliação 06–11/06 = Kommo 265 × painel 290 (painel inclusive maior, por leads de chat fora da Kommo).
- **Afetado:** tudo que entra em tempo real pela VPS — **mensagens de chat** (`interaction_db`), **chamadas** (`call_db`) e, por consequência, as **análises de IA** (que são disparadas pelas mensagens). Sem mensagem → sem análise → sem sentimento/cotação/upsell/score do período.
- **Perda real de negócio, não só de BI:** a própria Kommo recebeu ~44 leads/dia na janela vs ~85–100/dia de baseline — o agente de atendimento estava fora. Essa parte nenhum backfill devolve.
- **Irrecuperável pelo painel:** as ~650 mensagens de 08/06 e as chamadas de 08–09/06 não existem em nenhuma fonte que o painel acessa (a Kommo API v4 não fornece o histórico de chat; a transcrição de chamadas vinha pela ponte). Caminhos possíveis, fora do repo: histórico da Evolution API no servidor ou export do provedor de telefonia. Avaliar custo×benefício antes.

---

## 2. Backfill retroativo executado em 11/06 (Kommo + ShopMonkey + IA)

| Passo | Resultado |
|---|---|
| `reconcile-kommo` (antes, 06–11/06) | Kommo 265 × painel 290 (gap −9,4%: painel à frente) |
| `sync-kommo` `{days: 5}` | 262 leads na janela, **0 faltantes** (tudo já presente); 87 telefones enriquecidos; 123 espelhos/canais normalizados |
| `sync-shopmonkey` `{days: 5}` | 147 agendamentos (66 green, 13 walk-ins), 90 orçamentos, 80 vendas, $35.678 |
| `sync-seller-to-kommo` `{days: 5}` | 131 clientes; 17 CFs gravados na Kommo; 54 leads com vendedor propagado (38 erros de lookup — normal, telefone ausente) |
| `backfill-lead-language` `{max_batches: 20}` | 14 idiomas detectados (o restante são espelhos Kommo sem texto de chat) |
| **Reanálise de IA** (leads 06–11/06 com conversa e sem análise) | **55/55 analisados com sucesso** — sentimento e score voltaram para 100% desses leads |
| `scan-services` (backfill de `services_detected`, ~8.4k leads sem o campo) | Em execução em lotes; **+ cron diário novo** (`scan-services-daily`, 07:55 UTC, job 11) para nunca mais parar |

---

## 3. Diagnóstico item a item

Legenda das causas: **[DADO]** = dado faltante pela queda da VPS (resolvido pelo retorno + backfill) · **[CÁLCULO]** = crítica de cálculo procede, exige correção/decisão · **[BUG]** = defeito de código corrigido agora · **[SCRIPTS]** = depende dos scripts/playbooks de IA.

### Aba Visão Geral

**1. "Hoje"/"Ontem" imprecisos e sem aparecer (Conversão de Venda/Agendamento 0.0%)** — **[DADO]** + ressalva estrutural. Na validação (10/06), "Ontem" = 09/06: dia com 174 mensagens e 12 análises (vs ~700/60). Sem análise não há cotação/sentimento; e conversão de dia-corrente tende a 0% legitimamente porque o status "venda ganha" raramente é marcado no mesmo dia em que o lead é criado (a venda de hoje vem de lead de dias atrás). Recomendação registrada: para janelas de 1 dia, exibir as conversões com aviso de amostra/atraso de status, ou calculá-las por data do evento (venda paga no dia ÷ leads do dia não é uma fração coerente).

**2. Taxa de conversão desconfiável em 24h/"Ontem"** — mesmo diagnóstico do item 1: amostra mínima + status que muda dias depois da criação do lead. Em janelas ≥7 dias os números fecham com a Kommo (reconciliação diária no card "Saúde da base").

**3. Leads com cotação imprecisos (0 em "Ontem")** — **[DADO]**. `lead_price` vem majoritariamente da IA lendo o chat. 07–09/06: 1/3/5 leads com cotação vs 22–31 de baseline. Com a reanálise de 11/06 os números da janela foram recompostos no que havia de conversa.

**4. Valor médio cotado e tempo mediano 1ª resposta N/A ("Ontem")** — **[DADO]**. Ambos derivam de mensagens (`interaction_db`): sem mensagens em 08/06, não existe "1ª resposta" para medir nem cotação para calcular média. Voltaram a operar com o retorno da ingestão (10/06 em diante).

**5. Número de walk-ins impreciso** — **[CÁLCULO/decisão]**. O KPI conta `shopmonkey_appointment.walk_in = true` por data do agendamento; o flag é extraído do TEXTO do note ("WALKIN", "WALK-IN", "WALK:" etc., ~93% de precisão). No calendário da auditoria, os itens circulados são os **azuis** — e há agendamentos azuis SEM a palavra "walkin" no note (ex.: 10/06 tem 3 azuis e só 2 com o texto). **Hipótese a confirmar com a loja: a convenção real é "agendamento azul = walk-in"?** Se sim, mudamos a regra para `nota OU cor azul` (1 linha no sync). Não mudamos sem confirmação para não inflar.

**6. Valor de upsell e oportunidade de upsell imprecisos ("Ontem" 0/N-A)** — **[DADO]**. `has_upsell`/`upsell_value_estimate` são escritos pela análise de IA — que não rodou na janela. Recomposto na reanálise para os leads com conversa.

**7. Conversão por tempo de resposta e por cotação "sem dados suficientes"** — **[DADO]**. Os dois gráficos exigem leads auditados pela IA no período (e ≥3 mensagens no primeiro). Em 08–09/06 não havia nem mensagens nem análises. Normalizou com a volta.

**8. Estratégia de venda e pontuações da IA podem operar (scripts novos subidos)** — **[SCRIPTS] com pendência importante**: a tabela `playbooks` do banco de produção contém **7 scripts datados de 21/11/2025** (5 reais + 2 de teste). **Os "scripts novos" não chegaram ao banco que a IA usa.** Precisamos do canal onde foram subidos (Configurações do painel? outro lugar?) para carregá-los na tabela `playbooks` — sem isso a pontuação continua usando o roteiro de novembro.

**9. Mensagens e chamadas da aba "Hoje" pararam de funcionar** — **[DADO]**. Os cards leem `interaction_db`/`call_db` do dia — zerados na queda (08/06 = 0 mensagens; 08–09/06 = 0 chamadas). Com a VPS de volta, 10/06 já registrou 744 mensagens e 32 chamadas. Nota: "hoje" usa o fuso do navegador de quem vê — para quem valida do Brasil, o dia vira 1h antes do horário da loja (ET).

**10. Score médio pode ser usado (scripts atualizados)** — OK; ver pendência do item 8 (os scripts novos precisam entrar na tabela `playbooks`). O score em si (`lead_score`) está sendo gravado em 100% das análises novas (verificado em 11/06: 55/55).

**11. Gráfico sentimentos de hoje não funciona** — **[DADO]**. Sentimento vem da análise de IA dos leads criados no dia. Sem análise (queda), card vazio. Verificado em 11/06: sentimento gravado em 55/55 análises novas — o gráfico volta a funcionar em tempo real.

**12. Leads quentes sem resposta podem ser utilizados** — OK. Ressalva: o card depende de `last_interaction_at` (mensagens em tempo real); durante quedas da ingestão ele entende "sem resposta" onde houve conversa não ingerida.

### Aba Leads

**13. Inteligência de Produtos não confiável (DASHCAM 29 / 0 · 0.0%)** — **[BUG] corrigido**. Causa raiz encontrada: `services_detected` (o que o cliente PROCURA) **parou de ser populado em 07/04** — o `scan-services` (varredura por palavra-chave, custo zero) nunca teve agendamento; só o `upsell_products` (escrito pela IA) continuou vivo. Resultado: produtos apareciam só com o número verde de upsell, com leads=0 e fatia 0.0% — exatamente o print da auditoria. **Correção:** backfill do estoque (~8,4 mil leads sem o campo, rodando em lotes) + **cron diário novo** (`scan-services-daily`) para manter. O gráfico também NÃO tem (nem nunca teve) coluna de conversão por produto — o "0 · 0.0%" do print é leads·fatia, não venda; se quiserem conversão de venda POR PRODUTO (cruzando com ShopMonkey), é feature nova a especificar.

**14. Oportunidades de Upsell não atualiza com o período** — **[BUG] corrigido**. Confirmado no código: a seção da aba Leads calculava os dois cards sobre TODOS os leads carregados, ignorando o filtro de período (por isso 2185/$244 mil estáticos). Agora filtra por `created_at` dentro do período selecionado (mesma base dos demais cards).

### Aba Vendedores

**15. Conversão & funil por vendedor: leitura imprecisa ("Total: 0 leads, 19 orçamentos, 14 agendamentos, 17 vendas, Conversão 0%")** — **[CÁLCULO] — crítica procede; precisa da conversa que o auditor pediu.** O indicador mistura três bases com datas e atribuições diferentes:
  - *Leads* = leads CRIADOS no período **com vendedor atribuído** na Kommo (a atribuição vem de uma ponte diária ShopMonkey→telefone→Kommo; cobre parte da base);
  - *Orçamentos/agendamentos* = ShopMonkey por data de criação/início;
  - *Vendas* = ShopMonkey por data de **pagamento**.
  Em períodos curtos isso produz "17 vendas com 0 leads" (a venda paga hoje vem de lead de semanas atrás) e conversões absurdas (reproduzimos no banco: Henrique 90,5%, Gabriel **115,8%** na janela 03–10/06). **Mitigação aplicada agora:** quando não há leads atribuídos no período, o total mostra "—" em vez de "Conversão 0%", com nota explicando o descasamento de datas. **Decisão pendente com vocês:** ou (a) conversão por coorte (vendas geradas pelos leads criados no período, independente de quando pagou), ou (b) funil por data de evento sem dividir um pelo outro. Recomendamos (a).

**16. Qualidade dos vendedores imprecisa + 17. Ranking impreciso e com "erros de ortografia"** — **[BUG] corrigido (ortografia) + transparência (precisão)**. Os "erros de ortografia" eram **corrupção de encoding** no componente do ranking ("ConversÃ£o", "CotaÃ§Ãµes", "ObjeÃ§Ãµes Sup.", "3Â°") — o arquivo foi salvo com encoding errado em algum commit; todos os textos foram corrigidos ("Conversão", "Cotações", "Objeções Sup.", "1º/2º/3º"). Sobre a precisão: esta seção mede SÓ a amostra de chat auditada pela IA (subconjunto, ~50% dos leads do período) e o "Conversão" dela inclui agendamento confirmado além de venda — diferente da seção de cima (loja). É a mesma raiz da confusão do item 15 e da legenda B (abaixo): propomos consolidar as duas seções num funil único por vendedor, com a conversa do item 15.

### Aba Leads/Upsell (item 14 já coberto) · Painel 360 · Canais · Chamadas (legendas das capturas)

**A. "% Positivo de ligações é subjetivo; queremos ligações CONVERTIDAS com base na transcrição"** — **[melhoria a especificar]**. Hoje o card lê `ai_call_analysis.sentiment` (clima da conversa, subjetivo mesmo). A análise de chamada já extrai `close_attempt`, `sales_opportunities` etc., mas **não existe campo "ligação convertida"**. Proposta: (1) curto prazo — adicionar ao prompt da análise um campo `call_outcome` (agendou/comprou/pediu orçamento/sem avanço) e exibir "% de ligações com conversão" ao lado do % positivo; (2) médio prazo — cruzar a chamada com o desfecho real do lead (venda/agendamento no ShopMonkey via telefone). Como era na plataforma anterior de vocês, o (1) replica o comportamento conhecido.

**B. "Não entendi a diferença do dash de cima para o de baixo (Vendedores); consolidar; visão por canal de atendimento"** — ver item 15/16. A diferença real: o de cima é a LOJA (ShopMonkey + leads Kommo atribuídos), o de baixo é a amostra de CHAT auditada pela IA. Concordamos em consolidar; e a visão "atendimentos × agendamentos por canal (Kommo, ligação receptiva, presencial)" é viável se os vendedores registrarem o canal — hoje o canal só existe para leads de chat/Kommo (`source_id`), não para atendimento presencial/ligação receptiva.

**C. Canais: tooltips repetidos + "Indicação é origem, não canal" + falta Presencial** — **[BUG] corrigido (tooltips) + decisão (estrutura)**. Os tooltips do comparativo usavam o texto do WhatsApp para todos os canais (inclusive Telefone/E-mail, onde estava errado); agora cada canal tem texto de fonte próprio. Sobre Indicação: procede — é origem, não canal; **no banco não existe nenhum lead com canal "indicação" nos últimos 30 dias** (whatsapp 1757, phone 647, instagram 219, facebook 99), o card sempre esteve vazio. Proposta: remover Indicação da régua de canais e tratá-la como origem (ela já é capturada no note do ShopMonkey como "indicação"); e adicionar **Presencial** alimentado pelos walk-ins do ShopMonkey (decisão de produto — depende do item 5).

**D. Painel 360: nota média zerada; conversão divergente da Visão Geral** — **dois problemas distintos:**
  - *Conversão divergente* — **[BUG] corrigido**: o 360 calculava ganho÷auditados pela IA (7%), enquanto a Visão Geral usa venda÷base completa (10,4%). Agora o 360 usa exatamente a mesma definição e fonte da Visão Geral, com legenda explícita.
  - *Nota média 0.0* — **[pipeline quebrado + scripts]**: `service_rating` deixou de ser devolvido pela IA por volta de **04/05** (última semana de abril: 1.714 notas/1.717 análises; desde maio: ~0, embora o compliance continue vindo em ~35%). Soma-se o item 8 (playbooks no banco são de nov/2025). Correção em duas frentes: carregar os scripts novos na tabela `playbooks` e ajustar o `analyze-lead` para exigir/validar o campo (ou derivar a nota do compliance enquanto isso). **Não fechamos isso hoje** — precisa de teste de prompt com cuidado.

**E. "Conversão de agendamento (5,8%) menor que conversão de venda (10,4%) não faz sentido; 'faltou agendamento' deve contar como agendamento, com no-show separado"** — **[CÁLCULO] — o auditor tem razão e a mudança é simples e segura:**
  - Hoje o numerador de agendamento conta APENAS o status atual `Agendamento confirmado` — quem já avançou para `Venda ganha` sai do numerador de agendamento (status é um snapshot, não histórico), e `Faltou agendamento` é excluído. Por isso venda > agendamento.
  - Correção proposta (1 migration): **agendamento marcado = "agendamento confirmado" + "faltou agendamento" + vendas** (todo mundo que chegou a marcar), e expor **no-show** como métrica separada (`Faltou agendamento ÷ agendamentos marcados`). Fica: agendamento ≥ venda sempre, como o funil real. Deixamos pronta para aplicar após o OK de vocês, porque muda número visível do cliente.

---

## 4. Resumo das ações desta rodada

**Corrigido no código (deploy junto deste PR):**
1. Encoding do ranking de vendedores (Conversão/Cotações/Objeções/1º-2º-3º) — itens 16/17.
2. Upsell da aba Leads agora respeita o período — item 14.
3. Conversão do Painel 360 = mesma definição da Visão Geral — legenda D.
4. Tooltips por canal na aba Canais (sem texto de WhatsApp em Telefone/E-mail) — legenda C.
5. Total do funil por vendedor honesto ("—" + nota explicativa quando não há leads atribuídos no período) — item 15 (mitigação).
6. Cron diário `scan-services-daily` + backfill de `services_detected` (~8,4k leads) — item 13. *(cron já aplicado em produção)*

**Backfill retroativo executado (06–11/06):** sync-kommo, sync-shopmonkey, ponte de vendedor, idiomas, reanálise de IA (55/55) — seção 2.

**Decisões/pendências com a Pro Car:**
- Item 5: confirmar convenção "agendamento azul = walk-in" no ShopMonkey.
- Item 8/10/D: onde os scripts novos foram subidos? Precisam entrar na tabela `playbooks`.
- Item 15/16/B: aprovar a consolidação do funil por vendedor e a conversão por coorte.
- Legenda E: aprovar a redefinição "agendamento marcado inclui no-show e vendas, com no-show separado".
- Legenda A: aprovar o campo `call_outcome` (ligação convertida) na análise de chamadas.
- Mensagens de 08/06 e chamadas de 08–09/06: irrecuperáveis pelas fontes do painel; se valer a pena, recuperar do histórico da Evolution API no servidor.

**Bug em aberto (follow-up técnico):** `service_rating` não retornado pela IA desde ~04/05 (nota média) — exige ajuste e teste do `analyze-lead`. *(resolvido na 2ª onda — ver abaixo)*

---

## 5. Segunda onda (11/06, após aprovação da Pro Car) — itens que estavam pendentes

### 5.1 Item 5 — Walk-in azul (CONFIRMADO e aplicado)
A Pro Car confirmou a convenção: **agendamento azul no ShopMonkey = walk-in**. Evidência que levou à pergunta: 64,7% dos azuis tinham "WALKIN" escrito vs <5% das demais cores. Aplicado: regra `walk_in = texto no note OU cor azul` no `sync-shopmonkey` + retroativo no banco. **Walk-ins de 30 dias: 68 → 111 (+63%)**.

### 5.2 Legenda E — Conversão de agendamento redefinida (aplicada)
`get_leads_kpis` agora conta **agendamento MARCADO = confirmado + faltou (no-show) + vendas** e expõe `no_show_leads` separado (card mostra "X no-show"). Sanidade 7 dias: venda 10,2% × agendamento 16,0% — **agendamento ≥ venda, como o funil real**. (Antes: 5,8% < 10,4%, o absurdo apontado.)

### 5.3 Nota Média 0.0 — CAUSA RAIZ encontrada e corrigida
Não era só o modelo: **a tabela `playbooks` em produção não tinha a coluna `stage_requirements`** que a versão "stage-aware" do `analyze-lead` (deployada ~04/05) seleciona — TODO fetch de playbook falhava com erro 42703 → `playbook = null` → compliance E nota nulos em todas as análises desde então. Correções: (a) coluna criada; (b) `service_rating` agora é validado/coagido (aceita nota 0, que o antigo `|| null` descartava) e, se o modelo omitir, é derivado do compliance computado. **Teste vivo: notas 0, 2 e 6 gravadas** — e a repopulação dos últimos 7 dias está rodando. A Nota Média do Painel 360 volta a operar.

### 5.4 "Dashboard deve ser igual à Kommo" (exigência nova, print de 50 leads)
Investigação com janelas alinhadas mostrou DOIS problemas distintos:
1. **Fuso da virada do dia**: o "Hoje" do painel virava no fuso do navegador de quem vê (auditor no Brasil = 1-5h antes da Kommo). No momento do print, o "Hoje" da Kommo ainda era 10/06 (~50 leads) e o do painel já era 11/06 (madrugada). **Fix**: `Hoje/Ontem/7d…` agora são ancorados no fuso da loja (`America/New_York`) para qualquer espectador.
2. **Excedente do painel (+10-20%)**: o lead_db é insert-only — leads **apagados/mesclados na Kommo** continuavam contando aqui. **Fix**: `reconcile-kommo {mark_missing}` marca `kommo_absent` comparando IDs com a Kommo (folga de ±1 dia nas bordas); a view `lead_db_painel` e todos os KPIs/abas excluem marcados; cron diário mantém. Retroativo de 4 meses marcou 596 órfãos. **Verificação na janela exata do print do auditor (10/06): Kommo 56 × painel 56 — gap ZERO.** Janelas antigas (abril–maio) ainda têm gap residual de 2-4% (leads que nunca entraram no espelho), convergindo conforme o cron roda.

### 5.4b Painel 360 = Visão Geral, com DUAS taxas (pedido 11/06)
O Painel 360 passa a mostrar exatamente os números da Visão Geral: card de Leads = mesma base (espelho Kommo + chat, sem duplicatas/ausentes) e, no lugar da "Conversão" única, **Taxa de Orçamentos Pagos** (= Conversão de Venda) e **Taxa de Agendamentos** (= Conversão de Agendamento, marcados incl. no-show e vendas), cada uma com sua tendência.

### 5.5 Legenda A — "% Convertidas" nas Chamadas (aplicada)
`analyze-call` agora extrai `call_outcome` (agendou / comprou / pediu_orcamento / followup / sem_avanco / nao_qualificado) da transcrição, e a aba Chamadas tem o KPI **"% Convertidas"** (agendou+comprou+orçamento ÷ analisadas) ao lado do % Positivo — que ganhou a ressalva de subjetividade. Vale para ligações analisadas a partir de 11/06.

### 5.6 Legenda B — Consolidação dos Vendedores (fase 1 aplicada)
Descoberta: a equipe JÁ escreve o canal no note do agendamento ("… RICARDO **KOMMO**", "… RICARDO **TELEFONE**"). O `parse-note` agora extrai isso para `shopmonkey_appointment.channel`, o RPC devolve `agendamentos_por_canal` e cada card de vendedor mostra a quebra (30d: Kommo 117 · Presencial 77 · Ligação 32 · Google 14 · IG 5 · FB 2 · 582 sem marcador). A seção de qualidade do chat ganhou texto explicando a relação entre os dois quadros ("o que produziu" × "como atendeu"). Cobertura do canal sobe se os vendedores padronizarem o marcador — exatamente a sugestão do auditor. A consolidação total num quadro único segue em desenho (item 15).

### 5.7 Pendências que REALMENTE ficam com a Pro Car
- **Scripts novos (itens 8/10)**: a tabela `playbooks` segue com os scripts de 21/11/2025. Onde os novos foram subidos? Precisam entrar na tabela (e podem preencher o `stage_requirements` novo).
- **Item 15**: desenho da conversão por coorte do funil por vendedor (conversa pedida pelo auditor).
- **Canal Presencial / remover Indicação na aba Canais**: decisão de produto.
- **Mensagens de 08/06 e chamadas de 08–09/06**: irrecuperáveis pelas fontes do painel (só Evolution API no servidor).
