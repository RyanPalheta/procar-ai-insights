

## Analise e Melhorias dos Filtros da Pagina de Leads

### Problemas Identificados

**1. Filtros Ausentes para Colunas Importantes**
A tabela exibe Canal, Status de Venda, Score e Compliance, mas nenhum desses campos possui filtro dedicado. O usuario precisa usar a busca por texto para filtrar por canal ou status, o que e impreciso.

**2. Limite de 1000 Registros na Query**
A query atual (`supabase.from("lead_db").select("*")`) esta limitada a 1000 registros pelo default do banco. Com 4.315 leads na base, **mais de 3.000 leads sao invisveis** para o usuario. Todos os filtros operam sobre dados incompletos.

**3. Dados de Canal Nao Normalizados**
Existem duplicatas: `facebook`/`Facebook`, `whatsapp`/`WhatsApp`, `instagram_business`/`Instagram`. Isso causa inconsistencias nos filtros e contagens.

**4. Botoes de Periodo Rapido Sem Indicacao Visual**
Os botoes "Hoje", "Ultimos 7 dias" etc. nao mostram qual esta ativo. O usuario nao sabe qual periodo selecionou apos clicar.

**5. Sem Paginacao**
Todos os leads filtrados sao renderizados de uma vez na tabela, o que prejudica performance com volumes altos.

**6. Sem Ordenacao nas Colunas**
A tabela nao permite ordenar por Score, Data, Compliance ou outros campos.

**7. Sem Filtro de Faixa de Score**
O score aparece na tabela mas nao ha como filtrar por faixa (ex: score >= 7).

**8. Sem Filtro de Faixa de Compliance**
O compliance aparece na tabela mas nao ha filtro de faixa (ex: >= 80%).

---

### Plano de Melhorias

#### Correçao 1: Resolver Limite de 1000 Registros (Critico)
Implementar paginacao na query do banco para buscar todos os registros, usando chamadas sequenciais de 1000 em 1000 ate esgotar os dados, ou migrar para filtragem server-side via query parametrizada.

**Abordagem recomendada**: Filtragem server-side -- enviar os filtros ativos como parametros da query Supabase para que o banco faca o trabalho pesado e retorne apenas os resultados relevantes, com paginacao real (offset/limit).

#### Correçao 2: Adicionar Filtro por Canal
Dropdown com as opcoes: WhatsApp, Facebook, Instagram. Com contagem de leads por canal.

#### Correçao 3: Adicionar Filtro por Status de Venda
Dropdown dinamico populado pelos 17 status unicos existentes na base, com contagem por status.

#### Correçao 4: Adicionar Filtro de Faixa de Score
Dois inputs numericos (min/max) ou um slider duplo para filtrar leads por faixa de score (0-10).

#### Correçao 5: Adicionar Filtro de Faixa de Compliance
Slider duplo para filtrar por faixa de compliance (0-100%).

#### Correçao 6: Indicacao Visual do Periodo Rapido Ativo
Rastrear qual botao de periodo rapido foi clicado e aplicar estilo `variant="default"` ao botao ativo.

#### Correçao 7: Paginacao na Tabela
Adicionar controles de paginacao (anterior/proximo, paginas) com 25-50 leads por pagina.

#### Correçao 8: Ordenacao nas Colunas
Permitir clicar nos headers da tabela para ordenar por Score, Data, Compliance, Temperatura (asc/desc).

---

### Detalhes Tecnicos

**Busca paginada (Correçao 1)**:
```typescript
// Substituir a query atual por uma que busca todos os registros
const fetchAllLeads = async () => {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase
      .from("lead_db")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    allData.push(...(data || []));
    hasMore = (data?.length || 0) === pageSize;
    from += pageSize;
  }
  return allData;
};
```

**Novos estados de filtro (Correçoes 2-5)**:
```typescript
const [channelFilter, setChannelFilter] = useState<string>("all");
const [salesStatusFilter, setSalesStatusFilter] = useState<string>("all");
const [scoreRange, setScoreRange] = useState<[number, number]>([0, 10]);
const [complianceRange, setComplianceRange] = useState<[number, number]>([0, 100]);
const [activeDatePreset, setActiveDatePreset] = useState<string | null>(null);
```

**Paginacao (Correçao 7)**:
```typescript
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 30;
const totalPages = Math.ceil((filteredLeads?.length || 0) / pageSize);
const paginatedLeads = filteredLeads?.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);
```

**Ordenacao (Correçao 8)**:
```typescript
const [sortField, setSortField] = useState<string>("created_at");
const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
// Headers clicaveis com icone de seta indicando direcao
```

**Normalizacao de canal no filtro**: Comparar em lowercase para unificar `facebook`/`Facebook` etc.

**Arquivos modificados**: Apenas `src/pages/Leads.tsx`

