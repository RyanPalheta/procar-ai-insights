
## Correção: Leads "Quentes", "Mornos" e Auditados Não Aparecem

### Causa Raiz

O slider de **Score** está configurado com `max={10}` (escala 0-10), mas os valores reais no banco estão na escala **0-100** (mínimo: 10, máximo: 95, média: 70).

Como o slider inicia com range `[0, 10]`, ele automaticamente **exclui os 434 leads que têm score acima de 10** -- que são exatamente todos os leads auditados pela IA (incluindo todos os quentes, mornos e frios).

Resultado visível:
- Total: 4316 leads, mas apenas 3883 aparecem (433 excluídos pelo slider)
- Filtrar por "Quente" retorna 0 (todos os 201 quentes têm score entre 75-85)
- Leads auditados são invisíveis com as configurações padrão

### Correção

**Arquivo**: `src/pages/Leads.tsx`

1. Alterar o estado inicial do `scoreRange` de `[0, 10]` para `[0, 100]`
2. Alterar o slider de Score para `max={100}` e `step={5}`
3. Atualizar a contagem de filtros ativos para comparar com os novos valores padrão `[0, 100]`

### Detalhes Tecnicos

Mudancas especificas no arquivo `src/pages/Leads.tsx`:

**Estado inicial** (~linha 59):
```typescript
// De:
const [scoreRange, setScoreRange] = useState<[number, number]>([0, 10]);
// Para:
const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
```

**Slider de Score** (~linha 631-638):
```typescript
// De:
<Slider min={0} max={10} step={1} value={scoreRange} .../>
// Para:
<Slider min={0} max={100} step={5} value={scoreRange} .../>
```

**Reset de filtros** (~linha 274):
```typescript
// De:
setScoreRange([0, 10]);
// Para:
setScoreRange([0, 100]);
```

**Contagem de filtros ativos** (~linha 289):
```typescript
// De:
scoreRange[0] !== 0 || scoreRange[1] !== 10,
// Para:
scoreRange[0] !== 0 || scoreRange[1] !== 100,
```

Essas 4 alteracoes resolvem o problema. Nenhum outro arquivo precisa ser modificado.
