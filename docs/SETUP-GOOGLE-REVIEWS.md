# Setup — Avaliações Google (Google Maps reviews)

Runbook para **ativar** o card "Avaliações Google" da Visão Geral.
Criado em 2026-06-06. **Status: código pronto, INATIVO até a key ser setada.**

> 🔒 **Regra de segurança:** a API key vive **só no backend** (secret da edge function).
> NUNCA colocar no `.env` nem com prefixo `VITE_` — qualquer `VITE_*` vai parar no
> bundle do navegador e fica exposto publicamente. Veja o fluxo no fim do doc.

---

## ✅ O que já está pronto no repositório

| Camada | Arquivo | O que faz |
|---|---|---|
| Tabela + RPC | `supabase/migrations/20260606220000_google_reviews.sql` | `google_reviews_snapshot` (1 snapshot/dia) + RPC `get_google_reviews()` + RLS de leitura |
| Edge function | `supabase/functions/sync-google-reviews/index.ts` | Puxa total + nota da Places API (New) e grava o snapshot |
| Cron diário | `supabase/migrations/20260606230000_cron_sync_google_reviews.sql` | Roda 07:15 UTC (padrão barssss + segredo `dash_anon_key` do Vault) |
| Config | `supabase/config.toml` | Registra a function com `verify_jwt = false` |
| Card | `src/components/dashboard/GoogleReviewsCard.tsx` | Total, nota com estrelas, "+N em 7 dias", link "Ver no Google" |
| Página | `src/pages/Dashboard.tsx` | Renderiza o card na Visão Geral (após os KPIs) |

Enquanto a tabela está vazia, o card mostra um aviso "configure a key" — nada quebra.

---

## 🔑 Passo 1 — Criar a API key no Google Cloud (~5 min)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e selecione/crie um projeto.
2. **Billing** → ative o faturamento no projeto.
   - A cota grátis do Maps Platform cobre de sobra: 1 chamada/dia ≈ **custo zero**.
3. **APIs & Services → Library** → procure e **habilite "Places API (New)"**.
   - ⚠️ É a *Places API (New)*, não a "Places API" antiga.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. (Recomendado) Edite a key → **API restrictions** → restrinja a **Places API (New)**.
   - NÃO use restrição por HTTP referrer — quem chama é o servidor (edge function), não o browser.
6. Copie a key (`AIza...`).

> A key do Gemini (`GOOGLE_GEMINI_API_KEY`) **não serve** aqui — é a Generative
> Language API, produto diferente. Precisa de uma key do Maps Platform.

---

## 🚀 Passo 2 — Deploy (uma vez)

```bash
# aplica a migration (tabela + RPC + cron)
supabase db push

# publica a edge function
supabase functions deploy sync-google-reviews
```

> Obs.: o cron aponta para `https://barssssarrijyfzbwxep.supabase.co` (mesmo padrão
> dos outros crons do projeto). Se o deploy for em outro projeto Supabase, ajustar a
> URL dentro de `20260606230000_cron_sync_google_reviews.sql` antes do `db push`.

---

## 🔐 Passo 3 — Setar a key (backend, NUNCA frontend)

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=AIza...   # <-- cole a key aqui
```

Pronto. A partir daqui o cron diário já preenche o card sozinho.

---

## ▶️ Passo 4 — Primeira sincronização + fixar o place_id (opcional, recomendado)

Dispare a function uma vez (não precisa esperar o cron):

```bash
curl -i -X POST 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/sync-google-reviews' \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H 'Content-Type: application/json' -d '{}'
```

O retorno traz o `place_id` (`ChIJ...`). Salve-o como secret para as próximas chamadas
pularem a busca por texto (mais barato, determinístico e imune a mudança de nome/endereço):

```bash
supabase secrets set GOOGLE_PLACE_ID=ChIJ...
```

### Variáveis de ambiente da function

| Secret | Obrigatório? | Default | Para que serve |
|---|---|---|---|
| `GOOGLE_PLACES_API_KEY` | **Sim** | — | A key do Maps Platform (Places API New) |
| `GOOGLE_PLACE_ID` | Não | — | `ChIJ...` da loja; pula o Text Search |
| `GOOGLE_PLACE_QUERY` | Não | `Pro Car Sound & Security, 267 Broadway, Malden, MA 02148` | Texto da busca, se não houver place_id |

---

## 🩺 Troubleshooting

- **Card continua "configure a key":** a tabela está vazia → a function nunca rodou com
  sucesso. Rode o `curl` do Passo 4 e veja o JSON de erro.
- **`Falta GOOGLE_PLACES_API_KEY ...` (500):** o secret não foi setado (ou deploy não pegou).
- **`Places ... 403` / `REQUEST_DENIED`:** billing desativado, "Places API (New)" não
  habilitada, ou a key está restrita a outra API.
- **`Nenhum lugar encontrado para a busca`:** ajuste `GOOGLE_PLACE_QUERY` ou setar `GOOGLE_PLACE_ID`.
- **Variação "+N em 7 dias" não aparece:** normal nos primeiros dias — precisa de
  histórico (≥ 7 snapshots diários) para comparar.

---

## 🔁 Como o dado flui (a key nunca chega ao browser)

```
[Edge Function sync-google-reviews]  ← GOOGLE_PLACES_API_KEY (secret, no servidor)
        │  chama Places API (New) e faz upsert
        ▼
[tabela google_reviews_snapshot]     ← total + nota (sem segredo)
        │  RPC get_google_reviews()
        ▼
[Frontend / card "Avaliações Google"] ← só lê números, nunca a key
```
