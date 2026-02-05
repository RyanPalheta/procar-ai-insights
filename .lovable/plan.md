
# Plano: Remover Menções ao GPT e Fechar Popup Automaticamente

## Objetivo
1. Remover todas as menções a "GPT" e "GPT-5" do popup de análise
2. Fechar o popup automaticamente quando a análise terminar

---

## Alterações Necessárias

### Arquivo: `src/components/leads/AIAnalysisPlan.tsx`

**Menções a remover/substituir:**

| Linha | Texto Atual | Texto Novo |
|-------|-------------|------------|
| 49 | "Análise de conversas com GPT" | "Análise de conversas com IA" |
| 66 | "Análise detalhada com GPT-5" | "Análise detalhada com IA" |
| 70 | "Enviar para análise GPT-5" | "Enviar para análise de IA" |

---

### Arquivo: `src/pages/LeadDetails.tsx`

**Alteração:** Quando `onComplete` for chamado pelo `AIAnalysisPlan`, fechar o dialog automaticamente.

A lógica já existe parcialmente - o `onComplete` é passado ao componente. Preciso verificar se o dialog está fechando corretamente após a conclusão.

**Implementação:**
- Adicionar um pequeno delay (1-2 segundos) após a conclusão para o usuário ver que terminou
- Fechar o dialog automaticamente após o delay

---

## Resumo das Mudanças

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `AIAnalysisPlan.tsx` | Texto | Substituir 3 menções de GPT por "IA" |
| `LeadDetails.tsx` | Lógica | Garantir fechamento automático do popup |

---

## Seção Técnica

### Código da substituição (AIAnalysisPlan.tsx)

```typescript
// Linha 49: subtask de análise de conversas
{ id: "2.2", title: "Análise de conversas com IA", status: "pending" },

// Linha 66: descrição da task de auditoria
description: "Análise detalhada com IA",

// Linha 70: subtask de envio para análise
{ id: "4.2", title: "Enviar para análise de IA", status: "pending" },
```

### Auto-fechamento do popup

O callback `onComplete` já é chamado quando todas as tasks terminam. Preciso garantir que ele fecha o dialog com um pequeno delay para UX.
