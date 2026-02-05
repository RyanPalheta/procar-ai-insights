

# Plano: Incluir "Agendamento Confirmado" na Taxa de Conversão

## Objetivo

Atualizar a função RPC `get_leads_kpis` para que a taxa de conversão conte leads com:
- `sales_status` contendo **"ganha"** ou **"won"** (atual)
- `sales_status` contendo **"agendamento confirmado"** (novo)

---

## Alteração Técnica

**Ação:** Criar migration SQL para atualizar a função

**Mudança na query `won_leads`:**

```sql
-- DE (atual):
WHERE (LOWER(sales_status) LIKE '%ganha%' OR LOWER(sales_status) LIKE '%won%')

-- PARA (novo):
WHERE (
  LOWER(sales_status) LIKE '%ganha%' 
  OR LOWER(sales_status) LIKE '%won%'
  OR LOWER(sales_status) LIKE '%agendamento confirmado%'
)
```

---

## Campos Afetados na Função

| Campo | Descrição |
|-------|-----------|
| `won_leads` | Contagem de leads convertidos (período atual) |
| `won_leads_previous` | Contagem de leads convertidos (período anterior) |

Ambos serão atualizados com a nova condição.

---

## Resultado

A taxa de conversão passará a considerar como "convertido":
- Vendas ganhas (`%ganha%`, `%won%`)
- Agendamentos confirmados (`%agendamento confirmado%`)

Nenhuma alteração visual necessária - apenas a lógica de cálculo muda.

