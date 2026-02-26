

# Aba "Vendedores" - Desempenho por Vendedor com Metas

## Resumo
Criar uma nova aba "Vendedores" no sidebar com ranking, KPIs por vendedor, metas configuraveis e graficos de desempenho. Inclui nova RPC backend, tabela de metas, e tela de configuracao.

---

## 1. Backend (Banco de Dados)

### 1.1 Tabela `seller_goals`
Nova tabela para persistir metas por vendedor e/ou globais:

```text
seller_goals
  id              uuid PK default gen_random_uuid()
  seller_id       text NULL          -- NULL = meta global (fallback)
  metric          text NOT NULL      -- ex: 'conversion_rate', 'leads_with_quote', etc.
  target          numeric NOT NULL   -- valor alvo
  direction       text NOT NULL      -- '>=' ou '<='
  active          boolean default true
  created_at      timestamptz default now()
  updated_at      timestamptz default now()
  UNIQUE(seller_id, metric)
```

Metricas suportadas: `conversion_rate`, `leads_with_quote`, `avg_quoted_price`, `objections_overcome_rate`, `median_first_response_time`, `walking_leads`, `avg_score`.

RLS: leitura para autenticados, escrita apenas admin (via `has_role`).

### 1.2 RPC `get_sellers_kpis`
Nova funcao que retorna um JSON array com KPIs agrupados por `sales_person_id`:

Para cada vendedor retorna:
- `seller_id`, `total_audited`, `won_leads`, `avg_score`, `new_audited_24h`, `leads_with_quote`, `avg_quoted_price`, `median_first_response_time_minutes`, `walking_leads`
- `total_with_objection`, `objections_overcome` (para calcular %)
- Versoes `_previous` de cada metrica para variacao de periodo

Parametro: `period_days integer DEFAULT NULL` (mesmo padrao da `get_leads_kpis`).

Filtra apenas leads com `last_ai_update IS NOT NULL` e `sales_person_id IS NOT NULL`.

---

## 2. Frontend - Estrutura de Arquivos

### Novos arquivos:
- `src/pages/Sellers.tsx` -- pagina principal da aba
- `src/components/sellers/SellersRankingTable.tsx` -- tabela de ranking
- `src/components/sellers/SellerDetailView.tsx` -- detalhe do vendedor (KPIs + graficos + metas)
- `src/components/sellers/SellerGoalStatus.tsx` -- componente de status de meta (badge + progress bar)
- `src/components/settings/SellerGoalsManager.tsx` -- configuracao de metas

### Arquivos modificados:
- `src/App.tsx` -- nova rota `/sellers`
- `src/components/layout/AppSidebar.tsx` -- adicionar item "Vendedores" no menu
- `src/pages/Settings.tsx` -- nova tab "Metas de Vendedores"

---

## 3. Pagina Vendedores (`/sellers`)

### 3.1 Visao Geral (Ranking)
- Filtros globais no topo: canal, status, idioma, range de datas, **vendedor** (multi-selecao)
- Toggle de periodo (7d / 30d / 90d / Todos) -- mesmo padrao do Dashboard
- Tabela ordenavel com colunas:
  - Vendedor (sales_person_id)
  - Taxa de Conversao (%)
  - Leads com Cotacao
  - Objecoes Superadas (%)
  - Tempo 1a Resposta (mediana)
  - Leads Presenciais
  - Status Metas (resumo: X em dia / Y atencao / Z abaixo)
- Quick search por nome de vendedor
- Clique em linha abre detalhe inline (expandivel) ou painel lateral

### 3.2 Detalhe do Vendedor
- 8 KPI Cards (mesmos do dashboard + "Objecoes Superadas") com variacao vs periodo anterior
- Secao "Metas": lista de metricas com meta configurada, mostrando:
  - Barra de progresso
  - Badge de status: "Em dia" (verde), "Atencao" (amarelo), "Abaixo" (vermelho)
  - Resumo no topo: "3 em dia / 1 atencao / 0 abaixo"
- Graficos (minimo 3):
  1. Timeline de leads do vendedor (created_at)
  2. Distribuicao por status de venda
  3. Objecoes: top categorias + % superadas
  4. (Opcionais) Canal, sentimento, temperatura

### 3.3 KPI "Objecoes Superadas"
- Definicao: `(COUNT(objection_overcome=true) / COUNT(has_objection=true)) * 100`
- Exibir: "X% (Y/Z)" onde Y = superadas, Z = total com objecao
- Calculado server-side na RPC

---

## 4. Configuracoes de Metas

### Nova tab em Settings: "Metas de Vendedores"
- Formulario para definir metas:
  - Selecionar vendedor (dropdown com lista de sellers + opcao "Global/Padrao")
  - Selecionar metrica (dropdown)
  - Valor alvo (input numerico)
  - Direcao: >= ou <= (auto-preenchido conforme metrica)
  - Ativo (switch)
- Tabela listando metas existentes com edicao inline e exclusao
- Meta global serve como fallback quando vendedor nao tem meta especifica

### Logica de status das metas:
- **Em dia**: valor atende a regra (>= ou <=)
- **Atencao**: esta a menos de 10% de distancia do alvo
- **Abaixo**: nao atende e esta fora do limiar de 10%

---

## 5. Navegacao

### Sidebar
Adicionar "Vendedores" na secao "PRINCIPAL", entre "Leads" e "Painel 360", com icone `UserCheck` ou `Users2`.

### Rota
`/sellers` -- protegida com `requiredRole="admin"`.

---

## 6. Sequencia de Implementacao

1. **Migracao SQL**: criar tabela `seller_goals` + RPC `get_sellers_kpis`
2. **Settings**: adicionar tab "Metas de Vendedores" com `SellerGoalsManager`
3. **Pagina Sellers**: ranking table + detalhe do vendedor + graficos
4. **Sidebar + Rota**: integrar na navegacao
5. **Status de metas**: componente de calculo e exibicao

---

## Detalhes Tecnicos

### RPC `get_sellers_kpis` (esqueleto SQL)
```sql
CREATE OR REPLACE FUNCTION get_sellers_kpis(period_days integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- Agrupa por sales_person_id
-- Retorna array JSON com KPIs por vendedor
-- Inclui versoes _previous para variacao
-- Inclui total_with_objection e objections_overcome
$$;
```

### Tabela seller_goals (RLS)
- SELECT: autenticados
- INSERT/UPDATE/DELETE: apenas admin via `has_role(auth.uid(), 'admin')`

### Componentes reutilizam:
- `KPICard` existente para cards de KPI
- `MagicBentoGrid` para layout visual
- Graficos Recharts (mesmo padrao dos charts existentes)
- `Table` do shadcn para ranking
- `Progress` para barras de meta
- `Badge` para status (em dia/atencao/abaixo)

