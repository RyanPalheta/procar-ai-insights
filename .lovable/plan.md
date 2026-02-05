
# Plano: Dashboard TV para Vendas e Atendimento

## Objetivo
Criar uma nova aba/rota de dashboard otimizada para exibicao em TV de time comercial. O design sera white theme, moderno, clean, altamente legivel a distancia e focado em motivacao da equipe de vendas.

---

## Arquitetura da Solucao

### Nova Rota
- **Rota:** `/tv` (acesso fullscreen, sem sidebar)
- **Arquivo:** `src/pages/TVDashboard.tsx`
- **Layout:** Fullscreen sem AppLayout (para uso em TV)

### Estrutura Visual (16:9)

```text
+----------------------------------------------------------------------+
|  [LOGO] Dashboard de Performance              [Auto-refresh: 30s]    |
+----------------------------------------------------------------------+
|                                                                       |
|   +-----------------+  +-----------------+  +-----------------+  +---+|
|   |   LEADS HOJE    |  |    CONVERSAO    |  |  1a RESPOSTA   |  |NOT||
|   |      247        |  |      34%        |  |      8m        |  |4.7||
|   |    +12% ↑       |  |     +5% ↑       |  |    +2m ⚠️      |  |+.2||
|   +-----------------+  +-----------------+  +-----------------+  +---+|
|                                                                       |
+-------------------+------------------------+--------------------------+
|  QUALIDADE DE ATENDIMENTO                  |   EFICIENCIA COMERCIAL  |
|  ┌─────────────────────────────────────┐   |   ┌──────┐ ┌──────┐ ┌──┐|
|  │ Script          87% ████████████░░░ │   |   │  $   │ │  🏷️  │ │💬│|
|  │ Saudacao ⚠️     72% █████████░░░░░░ │   |   │Finan.│ │Promo │ │Obj│
|  │ Qualificacao ⚠️ 68% ████████░░░░░░░ │   |   └──────┘ └──────┘ └──┘|
|  └─────────────────────────────────────┘   |                         |
|  💡 Atendimentos com script alto           |   Visual minimalista    |
|     convertem 28% mais                     |   com icones grandes    |
+--------------------------------------------+--------------------------+
|                    FOCO DE MELHORIA                                  |
|  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   Contorno    |
|  │ 1o Preco     │  │ 2o Tempo     │  │ 3o Concorr.  │   Geral:      |
|  │    58%       │  │    71%       │  │    69%       │   [64%]       |
|  │ ████████░░░░ │  │ █████████░░░ │  │ █████████░░░ │               |
|  └──────────────┘  └──────────────┘  └──────────────┘               |
|                                                                      |
|  ⚠️ Objecao "Preco" esta com baixo contorno hoje                    |
+----------------------------------------------------------------------+
```

---

## Componentes a Criar

### 1. Pagina Principal: `TVDashboard.tsx`

**Caracteristicas:**
- Tema claro forcado (ignora preferencia do sistema)
- Layout fullscreen sem sidebar
- Auto-refresh dos dados a cada 30 segundos
- Tipografia extra grande para legibilidade a distancia
- Animacoes suaves e nao distrativas

### 2. Componentes Internos

#### `TVKPICard`
Card grande para KPIs principais com:
- Icone colorido
- Valor em fonte extra grande (text-6xl ou maior)
- Indicador de tendencia colorido (verde/laranja)
- Barra de progresso sutil opcional

#### `TVQualitySection`
Card horizontal com barras de progresso grossas para:
- Compliance de script
- Saudacao inicial
- Qualificacao de lead
- Insight motivacional

#### `TVEfficiencySection`
Card com 3 icones grandes centralizados:
- Financeira apresentada (icone cifrao)
- Promocoes/Ancora (icone etiqueta)
- Contorno de objecoes (icone balao)

#### `TVObjectionRanking`
Ranking visual de objecoes com:
- Cards medios para top 3 objecoes
- Barra de progresso em cada item
- Badge lateral com taxa geral de contorno

---

## Dados Necessarios (ja disponiveis)

| Metrica | Fonte | Campo |
|---------|-------|-------|
| Leads Hoje | lead_db | COUNT WHERE created_at >= hoje |
| Conversao | RPC get_leads_kpis | won_leads / total_audited |
| 1a Resposta | RPC get_leads_kpis | median_first_response_time_minutes |
| Nota Media | lead_db | AVG(service_rating) |
| Script/Compliance | lead_db | playbook_compliance_score |
| Saudacao/Qualif. | lead_db | playbook_steps_completed |
| Estrategias | lead_db | used_offer, used_anchoring |
| Objecoes | lead_db | objection_categories, objection_overcome |

---

## Paleta de Cores (White Theme)

| Elemento | Cor |
|----------|-----|
| Background | #FFFFFF |
| Cards | #F8FAFC (gray-50) |
| Texto principal | #1E293B (slate-800) |
| Texto secundario | #64748B (slate-500) |
| Positivo (sucesso) | #22C55E (green-500) |
| Alerta (atencao) | #F97316 (orange-500) |
| Negativo | #EF4444 (red-500) |
| Bordas | #E2E8F0 (slate-200) |
| Sombras | rgba(0,0,0,0.05) |

---

## Secao Tecnica

### Estrutura de Arquivos

```text
src/
├── pages/
│   └── TVDashboard.tsx          # Pagina principal TV
├── components/
│   └── tv/
│       ├── TVKPICard.tsx        # Card de KPI grande
│       ├── TVQualitySection.tsx # Secao qualidade
│       ├── TVEfficiencySection.tsx # Secao eficiencia
│       └── TVObjectionRanking.tsx  # Ranking objecoes
```

### Rota (App.tsx)

```tsx
// Nova rota SEM AppLayout para fullscreen
<Route path="/tv" element={<TVDashboard />} />
```

### Navegacao (AppSidebar.tsx)

```tsx
// Adicionar link na secao PRINCIPAL
{ title: "Dashboard TV", url: "/tv", icon: Monitor }
```

### Auto-refresh

```tsx
// Refetch automatico a cada 30s
const { data: leads, refetch } = useQuery({
  queryKey: ["tv-leads"],
  queryFn: async () => {...},
  refetchInterval: 30000,
});
```

### Tema Claro Forcado

```tsx
// Forcando light mode na pagina TV
useEffect(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
  return () => {
    // Restaura tema anterior ao sair
  };
}, []);
```

### KPI Card Estilizado

```tsx
function TVKPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  isAlert 
}: TVKPICardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "p-3 rounded-xl",
          isAlert ? "bg-orange-100" : "bg-green-100"
        )}>
          <Icon className={cn(
            "h-6 w-6",
            isAlert ? "text-orange-600" : "text-green-600"
          )} />
        </div>
        <span className="text-slate-500 text-lg font-medium">{title}</span>
      </div>
      <div className="text-6xl font-bold text-slate-800 mb-2">
        {value}
      </div>
      {trend && (
        <div className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold",
          trend.isPositive 
            ? "bg-green-100 text-green-700" 
            : "bg-orange-100 text-orange-700"
        )}>
          {trend.isPositive ? <TrendingUp /> : <TrendingDown />}
          {trend.value}
        </div>
      )}
    </div>
  );
}
```

### Progress Bar Grosso

```tsx
function TVProgressBar({ 
  label, 
  value, 
  showAlert 
}: TVProgressBarProps) {
  const isLow = value < 70;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-slate-700 font-medium text-lg flex items-center gap-2">
          {label}
          {showAlert && isLow && (
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          )}
        </span>
        <span className={cn(
          "text-2xl font-bold",
          isLow ? "text-orange-600" : "text-green-600"
        )}>
          {value}%
        </span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isLow ? "bg-orange-500" : "bg-green-500"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
```

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/TVDashboard.tsx` | Criar | Pagina principal do dashboard TV |
| `src/components/tv/TVKPICard.tsx` | Criar | Componente de KPI para TV |
| `src/components/tv/TVQualitySection.tsx` | Criar | Secao de qualidade de atendimento |
| `src/components/tv/TVEfficiencySection.tsx` | Criar | Secao de eficiencia comercial |
| `src/components/tv/TVObjectionRanking.tsx` | Criar | Ranking de objecoes |
| `src/App.tsx` | Modificar | Adicionar rota /tv |
| `src/components/layout/AppSidebar.tsx` | Modificar | Adicionar link para Dashboard TV |

---

## Valor para o Negocio

1. **Visibilidade constante** - Equipe de vendas ve metricas em tempo real
2. **Motivacao visual** - Design positivo e inspirador
3. **Identificacao rapida de problemas** - Alertas visuais claros
4. **Competicao saudavel** - Rankings e metas visiveis
5. **Foco em melhoria** - Destaque para areas que precisam de atencao

---

## UX e Hierarquia Visual

- Leitura clara em ate 5 segundos
- Numeros grandes (6xl-8xl) com alto contraste
- Sem tabelas complexas
- Cores semanticas consistentes
- Visual motivador, nao punitivo
- Espacamento generoso entre elementos
