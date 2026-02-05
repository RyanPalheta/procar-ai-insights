

# Plano: Adicionar Análise de Estratégias de Venda à Auditoria de IA

## Objetivo
Fazer a IA verificar se o vendedor utilizou ofertas, promoções ou estratégias de ancoragem durante a venda, e usar essa informação para avaliar a qualidade do atendimento.

---

## Arquitetura da Mudança

```text
┌─────────────────────┐
│   lead_db           │
│   + used_offer      │
│   + offer_detail    │
│   + used_anchoring  │
│   + anchoring_detail│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   analyze-lead      │
│   + Prompt IA       │
│   + Schema campos   │
│   + Payload update  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   update-lead       │
│   + Suporte campos  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   LeadDetails.tsx   │
│   + Seção visual    │
│   "Estratégias de   │
│    Venda"           │
└─────────────────────┘
```

---

## O Que a IA Irá Analisar

### 1. Ofertas e Promoções
- Desconto oferecido ao cliente
- Promoção mencionada (ex: "promoção de verão", "desconto para pagamento à vista")
- Condições especiais (frete grátis, brinde, parcelamento diferenciado)

### 2. Estratégias de Ancoragem
- Apresentar primeiro o preço "de" (cheio) antes do preço "por" (promocional)
- Comparar com concorrência mostrando vantagem
- Mostrar valor agregado antes do preço (ex: "isso normalmente custa X, mas para você...")
- Pacotes com valor percebido maior

---

## Etapas de Implementação

### 1. Migration de Banco de Dados
Adicionar novas colunas na tabela `lead_db`:

```sql
ALTER TABLE lead_db 
ADD COLUMN used_offer boolean DEFAULT null,
ADD COLUMN offer_detail text DEFAULT null,
ADD COLUMN used_anchoring boolean DEFAULT null,
ADD COLUMN anchoring_detail text DEFAULT null;

COMMENT ON COLUMN lead_db.used_offer IS 
  'Se o vendedor usou alguma oferta/promoção durante a venda';
COMMENT ON COLUMN lead_db.offer_detail IS 
  'Descrição da oferta/promoção utilizada';
COMMENT ON COLUMN lead_db.used_anchoring IS 
  'Se o vendedor usou estratégia de ancoragem de preço';
COMMENT ON COLUMN lead_db.anchoring_detail IS 
  'Descrição da estratégia de ancoragem utilizada';
```

---

### 2. Edge Function: `analyze-lead`

**Arquivo:** `supabase/functions/analyze-lead/index.ts`

**Alterações no prompt de sistema** (~linha 163):
```
- TAMBÉM verifique se o vendedor utilizou estratégias de venda (ofertas, promoções, ancoragem de preço)
```

**Alterações no prompt do usuário** (~linha 283):
```
14. O vendedor ofereceu alguma promoção, desconto ou condição especial durante a conversa? (sim/não)
15. Se ofereceu, descreva qual oferta/promoção foi usada em uma frase
16. O vendedor utilizou estratégia de ancoragem de preço? Exemplos:
    - Mostrou preço "de X por Y"
    - Comparou com concorrência
    - Apresentou valor agregado antes do preço
    - Ofereceu pacote com mais valor percebido
17. Se usou ancoragem, descreva qual estratégia em uma frase
```

**Alterações no schema de tool parameters** (~linha 365):
```javascript
used_offer: {
  type: 'boolean',
  description: 'Se o vendedor ofereceu promoção, desconto ou condição especial'
},
offer_detail: {
  type: 'string',
  nullable: true,
  description: 'Descrição da oferta/promoção utilizada pelo vendedor'
},
used_anchoring: {
  type: 'boolean',
  description: 'Se o vendedor usou estratégia de ancoragem de preço'
},
anchoring_detail: {
  type: 'string',
  nullable: true,
  description: 'Descrição da estratégia de ancoragem utilizada'
}
```

**Alterações no payload de update** (~linha 495):
```javascript
used_offer: hasAgentMessages ? (analysisResult.used_offer || false) : null,
offer_detail: hasAgentMessages ? (analysisResult.offer_detail || null) : null,
used_anchoring: hasAgentMessages ? (analysisResult.used_anchoring || false) : null,
anchoring_detail: hasAgentMessages ? (analysisResult.anchoring_detail || null) : null,
```

**Impacto na nota de atendimento (service_rating)**:
O prompt existente será ajustado para considerar o uso de estratégias de venda na avaliação:
```
AVALIAÇÃO DO VENDEDOR:
...
6. Verifique se o vendedor usou técnicas de vendas (ofertas, ancoragem)
   - Usar estratégias de venda AUMENTA a nota do atendimento
   - Não usar estratégias em momento oportuno PODE diminuir a nota
```

---

### 3. Edge Function: `update-lead`

**Arquivo:** `supabase/functions/update-lead/index.ts`

**Alteração** (após linha 152): Adicionar suporte aos novos campos:
```javascript
if (body.used_offer !== undefined) {
  updateData.used_offer = body.used_offer
}
if (body.offer_detail !== undefined) {
  updateData.offer_detail = body.offer_detail
}
if (body.used_anchoring !== undefined) {
  updateData.used_anchoring = body.used_anchoring
}
if (body.anchoring_detail !== undefined) {
  updateData.anchoring_detail = body.anchoring_detail
}
```

---

### 4. UI: `LeadDetails.tsx`

**Arquivo:** `src/pages/LeadDetails.tsx`

**Nova seção após "Objeção"** (~linha 558):

```tsx
{/* Estratégias de Venda */}
{hasAgentMessages && (
  <div className="space-y-4">
    <Separator />
    <div>
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        <Megaphone className="h-3 w-3" />
        Estratégias de Venda
        <Sparkles className="h-3 w-3 text-primary" />
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Ofertas/Promoções */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-4 w-4 text-green-500" />
            <span className="font-medium">Oferta/Promoção</span>
            {lead.used_offer !== null && (
              <Badge variant={lead.used_offer ? "success" : "secondary"}>
                {lead.used_offer ? "✅ Usou" : "Não usou"}
              </Badge>
            )}
          </div>
          {lead.offer_detail && (
            <p className="text-sm text-muted-foreground italic">
              "{lead.offer_detail}"
            </p>
          )}
        </div>
        
        {/* Ancoragem */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-1">
            <Anchor className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Ancoragem de Preço</span>
            {lead.used_anchoring !== null && (
              <Badge variant={lead.used_anchoring ? "success" : "secondary"}>
                {lead.used_anchoring ? "✅ Usou" : "Não usou"}
              </Badge>
            )}
          </div>
          {lead.anchoring_detail && (
            <p className="text-sm text-muted-foreground italic">
              "{lead.anchoring_detail}"
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Resumo Visual da UI

| Campo | Exibição |
|-------|----------|
| `used_offer = true` | 🎁 Oferta/Promoção **✅ Usou** - "10% de desconto para pagamento à vista" |
| `used_offer = false` | 🎁 Oferta/Promoção **Não usou** |
| `used_anchoring = true` | ⚓ Ancoragem de Preço **✅ Usou** - "Mostrou preço de R$500 por R$350" |
| `used_anchoring = false` | ⚓ Ancoragem de Preço **Não usou** |

---

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migration para colunas |
| `supabase/functions/analyze-lead/index.ts` | Prompt + schema + payload |
| `supabase/functions/update-lead/index.ts` | Suporte aos novos campos |
| `src/pages/LeadDetails.tsx` | Seção "Estratégias de Venda" |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

---

## Seção Técnica

### Lógica de Análise da IA

O prompt instruirá a IA a buscar padrões como:

**Ofertas/Promoções:**
- "desconto", "promoção", "oferta especial"
- "condição especial", "preço promocional"
- "frete grátis", "brinde", "bônus"
- "parcelamento sem juros", "pagamento facilitado"

**Ancoragem:**
- "de X por Y", "antes custava", "normalmente custa"
- "comparado com", "na concorrência"
- "você está economizando", "economia de"
- "pacote completo", "valor agregado"

### Impacto na Avaliação de Qualidade

Quando `hasAgentMessages && playbook`, a nota `service_rating` considerará:
- **+1 ponto** se usou oferta/promoção de forma adequada
- **+1 ponto** se usou estratégia de ancoragem
- A nota máxima continua sendo 10

Isso incentiva o uso de técnicas de vendas pelo time comercial.

