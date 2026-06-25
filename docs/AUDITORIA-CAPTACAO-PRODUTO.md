# Auditoria — Captação de Produto nas Conversas — Pro Car AI Insights

**Data:** 2026-06-25 · **Escopo:** por que a "Inteligência de Produtos" mostrava muito menos produto do que os clientes pediam (e do que a loja agendava), e o que foi corrigido. · **Elaborado por:** Marcos Venâncio

> **Conclusão central (TL;DR):** hoje a loja **marcou 9 agendamentos** (CarPlay, tint, áudio, câmera) e os clientes **disseram claramente** o que queriam no chat, mas a Inteligência de Produtos detectava **só 1** (Window Tint). Não era um número errado — era a **esteira de detecção atrasada e com buracos**: 55% dos leads nunca foram escaneados, leads escaneados sem match ficavam presos num carimbo `[]` que nunca era reavaliado, e o catálogo de palavras-chave perdia frasings comuns ("i have my screen", "how much is install", "interior lighting"). **Corrigido:** detecção em **tempo real** a cada mensagem, catálogo unificado e expandido, e re-scan dos presos. Hoje passou de **1 → 6 produtos / 11 detecções**, batendo com o mix de agendamentos.

---

## 1. O sintoma

No fim da manhã de 25/06, o painel mostrava:

| Card | Valor | Fonte |
|---|---|---|
| Agendamentos Marcados | 9 (cresceu de 3 ao longo do dia) | `shopmonkey_appointment` (verde, por `created_date`) |
| Inteligência de Produtos | **1** (Window Tint, 100%) | `lead_db.services_detected` (texto do chat) |

São **duas fontes independentes**: agendamento vem do ShopMonkey (calendário da oficina, não precisa de chat); produto vem do texto do WhatsApp. Não têm que bater exatamente — mas **1 produto para 9 agendamentos + ~11 leads com pedido explícito** indicava captação quebrada, não só diferença de fonte.

## 2. Investigação (chats reais de hoje)

Leitura manual dos **16 leads** de hoje (`lead_db`, sem duplicados/`kommo_absent`). O que o cliente pediu × o que o sistema capturou:

| # sessão | Cliente pediu (chat) | `services_detected` (antes) | Situação |
|---|---|---|---|
| 23956255 | "I have my screen. **How much is install**" | `[]` | ❌ preso no carimbo vazio |
| 23956471 | "I'm interested in a **Screen Upgrade**" | `NULL` | ⏳ não escaneado |
| 23956531 | "**Audio Upgrade**… how much for **radio swap**" | `NULL` | ⏳ não escaneado |
| 23956705 | "precio de **card play**" | `NULL` | ⏳ não escaneado |
| 23956811 | "tela de som para o accord 2012" (PIONEER) | `NULL` | ⏳ não escaneado |
| 23956937 / 23956987 | "**interior lighting**" | `NULL` | ⏳ não escaneado |
| 23957035 | "**screen update**… I need the **rearview camera**" | `NULL` | ⏳ não escaneado |
| 23956259 | "I'm interested in **Window Tint**" | `['Window Tint']` | ✅ único detectado |

Cruzando com os **9 agendamentos** marcados hoje (nota do ShopMonkey traz o produto): `CARPLAY ×4 (1 Jensen)`, `TINT ×3`, `CHUCHERO/SUB ×2`, `CÂMERA DO RETROVISOR ×1`. **O mesmo mix dos chats** — confirmando que a informação **estava lá** e não foi extraída.

## 3. Causas-raiz

**1. Esteira de detecção atrasada (dominante).** Medição na base (25/06):

```
leads_total (sem dup/absent) : 12.893
nunca escaneados (NULL)      :  7.057  (55%)
escaneados vazios ('{}')     :    512
sem análise de IA            :  8.392  (65%)
leads de HOJE não escaneados :     14  de 16
último scan-services         : 07:55 UTC (~03:55 NY)
```

O `scan-services` roda em **lote por cron, 1× ao dia** (`supabase/migrations/20260623200000_scan_services_newest_first.sql`, `55 7 * * *`). Leads criados depois do lote esperam o dia seguinte. A RPC `get_product_intelligence` conta só quem tem `services_detected` não-vazio → hoje, 1.

**2. Armadilha do carimbo `[]` (bug estrutural).** Quando escaneava e não achava nada, gravava `services_detected = {}` para o lead sair da fila `IS NULL`. Mas o lote só pega quem está `NULL` (`only_unscanned`), então **os `[]` nunca eram reavaliados** — nem quando o cliente falava o produto depois. Ex.: **#23956255** ("how much is install") preso para sempre.

**3. Catálogo de palavras-chave com buracos.** Mesmo escaneando, perdia frasings reais: "i have a/my screen", "how much is install", "screen update", "radio swap", "interior lighting", "chuchero".

**4. Divergência entre as duas cópias do catálogo.** `scan-services` e `analyze-lead` mantinham listas **separadas**; a do `analyze-lead` ainda tinha o token solto `'sound'` (falso-positivo: a loja se chama "Pro Car **Sound**", casava em ~91% das conversas), que o `scan-services` já havia removido.

## 4. Correções implementadas (commit `abf4f59`)

| # | Correção | Arquivo |
|---|---|---|
| 1 | **Detecção em TEMPO REAL** — a cada mensagem do cliente, dispara `scan-services` single-mode (fire-and-forget, zero custo LLM). Não espera o lote. | `supabase/functions/ingest-interaction/index.ts` |
| 2 | **Fonte única** de palavras-chave (acaba com a divergência + bug do `'sound'`) | `supabase/functions/_shared/product-keywords.ts` (novo); importado por `scan-services` e `analyze-lead` |
| 3 | **Catálogo expandido** — screen/install/radio (CarPlay/Labor), interior lighting (Ambient), chuchero (Sound), jensen/pioneer 8600 (CarPlay) | `_shared/product-keywords.ts` |
| 4 | **Re-scan dos `[]`** — `scan-services` aceita `include_empty` p/ reavaliar os carimbados vazios com o catálogo novo; o tempo real (single-mode) não tem o gate `only_unscanned`, então leads parados em `[]` voltam a ser avaliados na próxima mensagem | `supabase/functions/scan-services/index.ts` |

Mais um **backfill** único (`newest_first` + `include_empty`) re-escaneou os leads de hoje e o histórico recente com o catálogo novo.

**Deploy:** edge functions publicadas direto no projeto `barssss` via Management API (token canônico); validadas por `deno check`. **Não houve mudança de frontend** — a Inteligência de Produtos lê `services_detected` direto (a RPC `get_product_intelligence` já estava sem gate de IA desde 23/06). O cron diário continua como **rede de segurança**.

## 5. Resultado verificado (ao vivo, 25/06)

| | Antes | Depois |
|---|---|---|
| Produtos detectados (hoje) | **1** (Window Tint) | **6 produtos / 11 detecções** |

`CARPLAY 7 (63.6%) · AMBIENT LIGHT 2 · LABOR 2 · SOUND SYSTEM 2 · BACKUP CAMERA 1 · WINDOW TINT 1`

O caso **#23956255**, preso em `[]`, passou a detectar **CarPlay + Labor**.

## 6. O que NÃO foi feito (e por quê) / follow-ups

- **`canonical_product` não funde marcas** (JENSEN/PIONEER→CarPlay): havia decisão anterior deliberada de manter marcas de áudio separadas (`supabase/migrations/20260606190000_canonical_product.sql`); a expansão de keywords já grava "CarPlay" direto, então não foi preciso.
- **Gatilho de tempo real não foi testado injetando mensagem** em produção (evitar lead/mensagem falsos); validado por `deno check` + pelo single-mode no backfill. Passa a valer nas próximas mensagens reais.
- **Blindar 100% os `[]` inativos**: o tempo real cobre leads ativos e o backfill cobriu o histórico atual. Para futuras mudanças de catálogo, dá para agendar um cron mensal com `include_empty` (não feito — evitar varredura redundante diária).
- **Mensagens criptografadas** ("Failed to decrypt message content", 3 leads hoje) são ponto cego de detecção **e** de IA — depende da ingestão (Evolution/WhatsApp), fora do escopo deste fix.
- **Opcional:** alimentar os produtos das **notas de agendamento** na Inteligência de Produtos (sinal mais forte de intenção: o cliente fechou).

---

*Evidências e queries desta auditoria: leitura de `lead_db` + `interaction_db` por sessão (hoje), `shopmonkey_appointment` (notas), e contadores de fila — via Management API do projeto `barssssarrijyfzbwxep`.*
