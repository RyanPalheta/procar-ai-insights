# Resposta à Auditoria do Dashboard — Ponto a Ponto

## Sobre este documento

<div class="factsheet">
<div class="fs-row"><span class="fs-k">Empresa</span><span class="fs-v">Pro Car Sound &amp; Security (operação nos Estados Unidos)</span></div>
<div class="fs-row"><span class="fs-k">Destinatário</span><span class="fs-v">Diretoria Pro Car</span></div>
<div class="fs-row"><span class="fs-k">Elaborado por</span><span class="fs-v">Marcos Venâncio — Responsável técnico (BI / Desenvolvimento do dashboard)</span></div>
<div class="fs-row"><span class="fs-k">Data</span><span class="fs-v">6 de junho de 2026</span></div>
<div class="fs-row"><span class="fs-k">Referências</span><span class="fs-v">Relatório de Auditoria do Dashboard (02/06/2026); Revisão de Aderência do Escopo; Escopo PROCAR.</span></div>
</div>

## Contexto

As correções desta rodada partiram do **escopo original do projeto**. Cada ponto da auditoria é reproduzido com o **texto original** e, ao lado, o **ajuste realizado**. A **Seção 1** reúne os pontos **contidos na obrigação do escopo** (correções de entregas contratadas); a **Seção 2**, os itens **pós-entrega** (novas solicitações da auditoria que extrapolam o escopo), já iniciados em paralelo.

**Status — legenda de cores**

- **FUNCIONAL** — verde — corrigido e operando.
- **EM AJUSTE** — amarelo — entregue; em ajuste de cálculo ou de base (não é falha estrutural).
- **PENDENTE (SCRIPTS)** — laranja — painel pronto; o valor depende dos scripts de IA da Pro Car.

---

# Seção 1 — Contidos na obrigação do escopo {.pagebreak}

## Requisitos transversais

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Moeda em dólar (USD).** "O dashboard está com a moeda em Real (BRL)... Trocar a currency para USD em todo o dashboard... o 'valor potencial de upsell' aparece cerca de 5x maior (mais de US$ 1 milhão, quando o esperado seria por volta de US$ 200 mil)." | Todo o painel passou a USD; estimativas de upsell desinfladas (de >US$ 1 mi para a ordem de ~US$ 200 mil). | FUNCIONAL |
| **Tooltips explicativos em todos os gráficos.** "Implementar, em todos os gráficos sem exceção, um pop-up ao passar o mouse (hover) explicando exatamente o que está sendo mostrado... e uma breve descrição de como o indicador é calculado." | "?" com *o que mostra / fonte / como é calculado* nos gráficos das abas principais. (Resta estender às abas de Anúncios — Seção 2.) | FUNCIONAL |
| **Filtro de período e atalho "Hoje" em todas as abas.** "(a) um seletor de período customizável (custom range) padronizado; (b) um atalho 'Hoje' à esquerda do botão '7 dias' em todas as abas; (c) filtros de data nas abas 'Canais' e 'Chamadas'." | Filtro padronizado com Hoje/Ontem + intervalo personalizado em todas as abas, inclusive Canais e Chamadas. | FUNCIONAL |
| **Confiabilidade dos dados (premissa central).** "A maioria dos volumes de leads diverge da base real (Kommo)... pedimos que a equipe documente a fonte e o racional de cálculo." | Fonte/racional documentados nos tooltips; reconciliação Kommo × painel ativa (mede o desvio por período); sincronizações horárias em operação. Convergência da base em curso. | EM AJUSTE |
| **Princípio "destrinchar".** "Sempre que possível, segmentar os dados por produto [...] idioma [...]. O objetivo é sair do 'chute' e operar de forma data-driven." | Segmentação por **produto** (Inteligência de Produtos) e por **idioma** (PT/EN/ES) entregue; aplicada como eixo nas novas features. | FUNCIONAL |

## Aba "Visão Geral"

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Leads por Língua.** "Muito impreciso. Deve trazer todos os atendimentos de um período e segmentá-los pelos idiomas... inglês, espanhol e português." | Segmentação por idioma com % por língua e tooltip de fonte; precisão acompanha a convergência da base. | EM AJUSTE |
| **Leads novos (24h) por canal.** "O número de leads novos não bate com o Kommo: o dashboard apontou 16 no dia; a auditoria encontrou 11. A quebra por canal também diverge." | Sincronização Kommo→painel trouxe os leads ausentes e normalizou o canal; em convergência de base. | EM AJUSTE |
| **Taxa de conversão (13,2%).** "Irreal... esclareça se 'conversão' significa venda ganha ou agendamento." | Regra explicitada no tooltip; falta a **definição de negócio** (venda e/ou agendamento) para unificar. | EM AJUSTE |
| **Leads com cotação.** "Número muito abaixo da realidade. A maioria dos leads recebe cotação." | Passou a considerar o preço vindo da Kommo, ampliando a base; segue subcontando até a base convergir. | EM AJUSTE |
| **Valor médio cotado.** "Incorreto e exibido em Real — deve ser USD. Revisar o cálculo." | Exibido em USD, média sobre cotações reais. | FUNCIONAL |
| **Tempo mediano da primeira resposta.** "Irreal... agora aponta 22 minutos, o que não condiz com a operação." | Recalculado para o tempo real cliente → equipe (mediana), corrigindo os "22 min". | FUNCIONAL |
| **Leads presenciais (walk-in).** "Forte subcontagem. Nos últimos 7 dias aponta zero walk-ins, sendo que só no sábado tivemos 7." | Religado à fonte real: o KPI agora conta o *note* do agendamento ShopMonkey (marcação de walk-in), por data do agendamento — não mais o chat/IA, que subcontava. Antes 7 dias = 0; agora 7 dias = 18, com o sábado (30/05) marcando 7. | FUNCIONAL |
| **Oportunidade de upsell (quantidade).** "Precisamos entender como a IA identifica a oportunidade... e definir o que faremos com o indicador." | Critério documentado (a IA marca a oportunidade); definição do uso de negócio a alinhar. | FUNCIONAL |
| **Valor de upsell (soma estimada).** "Depende do indicador anterior estar coerente e deve ser exibido em USD." | Soma em USD, com o histórico desinflado. | FUNCIONAL |
| **Gráfico "Leads novos por período".** "A flutuação/constância é razoável, mas os números não são acurados o suficiente." | Alinhamento de datas corrigido; volume melhora com a convergência da base. | EM AJUSTE |
| **Leads por status (etapa do funil).** "OK / razoável. Sem ação necessária." | Mantido; com tooltip. | FUNCIONAL |
| **Temperatura dos Leads.** "Não está claro o que o indicador mede. Requer tooltip (definindo cada faixa) e, sobretudo, segmentação [...]." | Tooltip definindo cada faixa (quente/morno/frio) + contagem por faixa. | FUNCIONAL |
| **Distribuição do sentimento.** "Não está claro o que mede, como é medido... Requer tooltip e maior detalhamento." | Tooltip com o que é / fonte / cálculo e segmentação Positivo/Neutro/Negativo. | FUNCIONAL |
| **Top 5 Produtos Desejados.** "Não queremos apenas o ranking dos 5 mais desejados: queremos um ranking global de todos os produtos e serviços [...]." | Substituído por **Inteligência de Produtos**: ranking global, share (pizza) e barras de quantidade. (Aba dedicada — Seção 2.) | FUNCIONAL |
| **Ranking de objeções.** "OK. Sem ação necessária." | Mantido. | FUNCIONAL |
| **Distribuição de compliance.** "123 leads auditados em 7 dias parece baixo/insuficiente... Ampliar a cobertura ou apresentar o racional de amostragem." | Racional de amostragem exposto no tooltip + total auditado; ampliação depende da IA rodar sobre mais leads. | EM AJUSTE |
| **Conversão por tempo de resposta.** "Interessante... mas a IA tem dificuldade de identificar o que passou por cotação, e fica confuso se 'conversão' é venda ou agendamento." | Parametrizado por período + tooltip; cálculo do tempo a alinhar ao novo método de 1ª resposta. | EM AJUSTE |
| **Conversão por cotação.** "Interessante, porém não confiável — os indicadores de conversão não fecham entre si." | Faixas em USD + período; coerência total depende da definição de "conversão". | EM AJUSTE |
| **Taxa de objeções contornadas.** "Indicador interessante, mas baseado em apenas 129 atendimentos auditados. Queremos ampliar a amostra." | Base e fórmula expostas no tooltip; amostra cresce com mais leads auditados. | EM AJUSTE |
| **Uso de estratégia de venda.** "Não avaliado nesta rodada por depender dos scripts atualizados." | UI e campos prontos; valor depende dos scripts de IA. | PENDENTE (SCRIPTS) |

## Aba "Hoje"

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Leads de hoje.** "Número impreciso frente ao que de fato chegou. Esclarecer se considera telefone." | Esclarecido na tela: conta só conversas de chat (não inclui telefone); base em convergência. | EM AJUSTE |
| **Número de mensagens.** "OK. Consistente com a média de ~10 mensagens por lead. Sem ação." | Mantido. | FUNCIONAL |
| **Número de chamadas.** "Correto — 100% de precisão na auditoria. Não mexer." | Mantido. | FUNCIONAL |
| **Vendas (hoje).** "Totalmente irreal. Aponta zero vendas às 15h, sendo que já realizamos várias vendas." | Passou a ler as vendas reais (pedidos pagos do ShopMonkey, em USD); encerra o "zero vendas". | FUNCIONAL |
| **Score médio.** "Não avaliado agora — depende dos scripts publicados hoje." | UI pronta; valor depende dos scripts. | PENDENTE (SCRIPTS) |
| **Gráfico "Canais de hoje".** "Trocar o formato de pizza para barras (quantitativo)." | Convertido para barras. | FUNCIONAL |
| **Gráfico "Sentimento de hoje".** "Mesmo ajuste: trocar de pizza para barras." | Convertido para barras. | FUNCIONAL |
| **Distribuição por hora.** "Visualização boa... Porém o volume parece baixo demais... double-check da acurácia." | Visualização mantida; o volume reflete só o chat (base em convergência). | EM AJUSTE |
| **Leads quentes sem resposta.** "O score exibido (95) parece errado... (Score em revisão — ver scripts.)" | Lógica do painel correta; a calibração do score depende dos scripts. | PENDENTE (SCRIPTS) |

## Aba "Leads"

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Leads frios sem follow-up / reativáveis.** "Aponta 6% de follow-up adequado, mas audita poucos leads... ampliar a cobertura de auditoria." | Varredura sem amostra fixa (todos os leads frios elegíveis) + 4 KPIs com fórmula no tooltip. | EM AJUSTE |
| **Valor potencial de upsell.** "Exibido em Real — trocar para USD. Aparece acima de US$ 1 milhão, cerca de 5x o esperado." | Em USD e desinflado; o ">US$ 1 mi" desaparece. | FUNCIONAL |

## Aba "Vendedores"

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Painel-resumo do vendedor.** "Indicadores do resumo não condizem com o dia: Conversão 15% (duvidoso); Cotações (dia) 1 (Ricardo fez dezenas de orçamentos); Objeções 17%." | Painel novo com números reais por vendedor (ShopMonkey): orçamentos, agendamentos, vendas, receita; "cotações = 1" virou os orçamentos reais. | EM AJUSTE |
| **Detalhe do vendedor.** "Ao abrir o detalhe, os números mudam e seguem irreais... Meta de conversão 15% (meta 10%)." | Lógica da meta corrigida (fim do "15% com meta 10%"); falta cadastrar os valores das metas. | EM AJUSTE |
| **Timeline dos leads.** "Irreal. Revisar a fonte." | Ancorada ao mesmo universo dos cards; volume acompanha a atribuição de vendedor. | EM AJUSTE |
| **Gráfico "Status de venda".** "Visualmente quebrado: corta/sobrepõe as letras e fica ilegível. Além disso, as proporções são irreais." | Layout corrigido (rótulos legíveis + tooltip) e base normalizada. | FUNCIONAL |
| **Top objeções (do vendedor).** "Lista algumas objeções, mas houve mais no período — a IA pode não estar capturando o total." | Apresentação correta; a completude é limitada ao que a IA detecta no chat. | EM AJUSTE |
| **Cadastro e segmentação de todos os vendedores.** "Cadastrar todos os vendedores e segmentar os indicadores por pessoa (Henrique, Matheus, Gabriel, além do Ricardo)." | Todos os vendedores reconhecidos e segmentados via ShopMonkey, com atribuição mantida viva por automação. | FUNCIONAL |

## Aba "Canais"

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Leads recebidos por canal.** "Imprecisos e divergentes da base — esta é a raiz... Exceção: o telefone está sendo puxado corretamente." | Telefone mantido (correto); demais canais rotulados e em convergência de base. | EM AJUSTE |
| **Volumes por canal (ranking comparativo).** "Útil como ideia, mas com os números errados acima. Pedimos destrinchar: [...] idiomas por canal e quais vendedores têm mais sucesso [...]." | "Idiomas por canal" entregue; o cruzamento por vendedor depende da atribuição de vendedor. | EM AJUSTE |

## Chamadas

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Volume de chamadas.** "Bom / consistente." | Mantido. | FUNCIONAL |
| **Duração média.** "OK." | Mantido. | FUNCIONAL |
| **Objeção, contornadas e uso de oferta.** "OK. A identificação de objeções pela IA é valiosa — manter." | Mantido. | FUNCIONAL |
| **Categorias por objeção.** "Boa. Vale manter a IA classificando as objeções." | Mantido. | FUNCIONAL |
| **Score e distribuição de scores.** "Não medidos — dependem dos scripts atualizados." | UI pronta (KPI + histograma); valor depende dos scripts. | PENDENTE (SCRIPTS) |
| **Volume e score por dia.** "Volume OK. A parte de score começa a valer a partir de agora (scripts)." | Volume mantido; linha de score acompanha os scripts. | FUNCIONAL |
| **Compliance médio.** "Não disponível hoje. Incluir o indicador." | Indicador criado (média de compliance da IA contra o playbook). | FUNCIONAL |
| **Distribuição de sentimentos.** "Esclarecer o que é e como é medido (aplicar tooltip e segmentação)." | Tooltip com fonte (Twilio + IA) e cálculo; segmentação Positivo/Neutro/Negativo. | FUNCIONAL |

## Meta Ads e Google Ads

| Ponto da auditoria (texto original) | Ajuste realizado | Status |
|---|---|---|
| **Dados de Meta Ads e Google Ads.** "Muito imprecisos... não batem com as planilhas oficiais dos últimos 90 dias... reconciliá-los com as exportações oficiais de 90 dias." | Fonte tornada rastreável (Meta via função server-side; Google via base externa). A **reconciliação com as exportações de 90 dias** é trabalho pós-entrega (Seção 2). | EM AJUSTE |

---

# Seção 2 — Pós-entrega do projeto {.pagebreak}

Solicitações da auditoria que **extrapolam o escopo contratado** (seção "Lacunas e novos requisitos" e "Novos pedidos"). Não são entrega imediata; abaixo, o texto original e o avanço já iniciado.

| Ponto da auditoria (texto original) | Andamento | Iniciado |
|---|---|---|
| **Avaliações (reviews).** "Não há nada no dashboard. Precisamos da quantidade e da qualidade das reviews, com acompanhamento interno... Urgente." | Card de reputação + sincronização prontos; aguardam chave de API e publicação. | ~85% |
| **Inteligência de produtos e serviços.** "Substituir o ranking de 5 produtos por... um gráfico de barras com a quantidade por produto e um gráfico de pizza com a distribuição (share)... Idealmente em uma aba dedicada [...]." | Núcleo (barras + share + ranking global) entregue na Visão Geral; falta a **aba dedicada**. | ~70% |
| **Chamadas por hora (novo pedido).** "Gráfico mostrando em qual horário do dia mais recebemos ligações e em qual horário os follow-ups mais convertem." | Gráfico de chamadas por hora entregue; falta o cruzamento horário × conversão. | ~70% |
| **Canal E-mail.** "Não há nada sobre leads por e-mail. Precisamos... quantos leads chegam por e-mail, quantos são respondidos, a qualidade e o percentual de conversão." | E-mail já entra no comparativo de canais; faltam "respondidos/qualidade" e aba própria. | ~40% |
| **Agendamento vs. Venda (receptivas e ativas).** "Precisamos dos DOIS indicadores separados — agendamento e venda — para receptivo e ativo." | Agendamento e venda já separados; falta o eixo receptivo vs. ativo. | ~30% |
| **Acompanhamento crítico por vendedor (chamadas, novo pedido).** "Adicionar, por vendedor: quem mais faz follow-up, quem mais converte, quem está convertendo menos." | Ativo vs. passivo entregue; a quebra por vendedor depende de capturar o atendente na origem da ligação. | ~30% |
| **Financiamentos / financeiras.** "Quantidade de financiamentos realizados. Trabalhamos com 3 financeiras, principalmente a Snap." | "% financeira apresentada" entregue; visão por financeira (Snap e demais) a construir. | ~25% |
| **Separação de orgânico vs. pago.** "Incluir mensagens orgânicas, agendamento orgânico e conversão orgânica... tudo segmentado por vendedor." | Origem já capturada no CRM; falta a visão de orgânico vs. pago no painel. | ~20% |
| **Canal Indicação (referral).** "Precisamos de indicadores próprios: quem indica, serviços com desconto de indicação, conversão por indicação e controle do programa." | Canal de indicação entregue; falta o **programa** (quem indica, desconto, conversão por indicador). | ~15% |
| **Ligações por vendedor.** "Precisamos auditar, por pessoa, a conversão em ligação (receptiva e ativa), upsell, agendamento e objeções." | Depende de capturar o vendedor na origem da ligação (hoje o registro de chamadas não traz o atendente). | A iniciar |
| **Leads perdidos (com motivos).** "Criar a categoria 'Leads perdidos' com a quebra por motivo: scam, lead inconsciente e leads em etapa inicial — com percentual e quantidade de cada." | Requer trazer o motivo de perda da Kommo para o painel. | A iniciar |
| **Cancelamentos.** "Não há indicadores. Precisamos de: quantos cancelamentos por dia, quais produtos cancelam mais..." | Requer capturar o status de cancelamento na origem. | A iniciar |

---

## Próximos passos

1. **Definição de "conversão"** (venda ganha e/ou agendamento) — alinha as taxas marcadas *em ajuste*.
2. **Convergência da base** (refletir no painel todas as origens da Kommo) — leva os itens *em ajuste* a funcionais.
3. **Aplicação dos scripts de IA** — destrava os indicadores de score (*pendentes*).
4. **Cadastro das metas** por vendedor.
5. **Priorização da Seção 2** conforme a agenda comercial.

*Documento interno e confidencial — Pro Car Sound & Security.*
