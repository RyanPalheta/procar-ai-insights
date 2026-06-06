# Plano — deduplicação chat ↔ Kommo por telefone

**Problema:** a reconciliação ao vivo mostrou o painel com *mais* linhas que a Kommo no
período (30d: 2.717 × 2.409). Causa: o `lead_db` só deduplica por `session_id` e **não
guarda telefone**, então o mesmo lead real pode aparecer 2× (linha de chat + espelho
`kommo_sync`). Hoje é impossível **nem medir** a duplicação — falta a chave (telefone).

## Onde o telefone vive (e como trazer)

| Fonte | Onde está | Como obter | Já no repo? |
|---|---|---|---|
| **Kommo** (principal) | no **contato** do lead (`_embedded.contacts` → CF `field_code='PHONE'`) | `GET /contacts?filter[id][]=…&limit=250` em lote (~1 chamada/250 leads) | sim, padrão inverso em `sync-seller-to-kommo` |
| **ShopMonkey** | `customer.phoneNumbers[].number` | `GET /v3/customer/{id}` (customer_id já gravado em `shopmonkey_*`) | sim, já usado |
| **Voz** (`call_db`) | `from_number` | já capturado | sim (`twilio-webhook`) |
| **Chat** (n8n) | origem WhatsApp (`remoteJid`/`From`) | n8n incluir `body.phone`; `ingest-*` aceitar (hoje **descarta**) | não |

Normalização (reaproveitar o que já existe em `sync-seller-to-kommo`/`analyze-call`): só
dígitos → tira DDI `1` (US) quando 11 díg. → **últimos 10 dígitos** como chave.

## ⛔ Por que NÃO usar DELETE/MERGE
1. **Re-inserção:** `sync-kommo` é insert-only por `session_id` (`ignoreDuplicates`). Apagar
   uma "duplicata" → a próxima sync **re-insere** → dedup destrutiva se reverte sozinha.
2. **Órfãos:** `session_id` é FK lógica de `interaction_db` (joins de *tempo de 1ª resposta*
   e *conversão por tempo*). Apagar linhas **quebra** esses KPIs.

## 🪜 Rollout incremental (aditivo)

| # | Passo | Risco | Status |
|---|---|---|---|
| **A** | Migration aditiva: `lead_db.phone` + `phone_normalized` + índice | zero | ✅ esta fase |
| **B** | `sync-kommo` traz telefone do contato + backfill (Kommo; ShopMonkey p/ walk-in) | baixo | ✅ esta fase |
| **C** | **Diagnóstico**: medir a duplicação real (telefones com >1 `session_id`; pares chat↔kommo_sync) | zero (leitura) | ✅ esta fase |
| **D** | Marcar não-destrutivo: `is_duplicate` + `canonical_session_id` via trigger | zero | ⏳ próxima |
| **E** | VIEW `lead_db_dedup` + migrar os 5 leitores atrás de feature flag | médio | ⏳ próxima |
| **F** | (opcional, muito depois) arquivar duplicatas — **nunca DELETE** | — | ⏳ |

**Ordem dos leitores no passo E:** `get_sellers_shopmonkey_kpis` primeiro (dedup **melhora**
a conversão), `reconcile-kommo` por último (precisa deduplicar **os dois lados**).

## ⚠️ Decisão de design (passo C decide o critério)
Há dois tipos de duplicação e a regra precisa separá-los:
- **Mesma oportunidade, 2 fontes** (chat + espelho Kommo) → *é* duplicata, colapsar.
- **Mesma pessoa, oportunidades diferentes no tempo** (cliente recorrente) → **manter**.

Logo o canônico **não** pode ser "1 linha por telefone" (perderia recompra). O passo C
mede e define a janela/critério.

## Superfície de impacto (quem lê contagem de `lead_db`)
`get_leads_kpis`, `get_sellers_kpis`, `get_sellers_shopmonkey_kpis` (denominador da
conversão), `reconcile-kommo` (gap), e `src/pages/Dashboard.tsx` (contagens client-side).
Efeito da dedup: contagens **caem**; conversão por vendedor **sobe** (denominador real);
`reconcile-kommo` precisa deduplicar os dois lados pro gap continuar válido.
