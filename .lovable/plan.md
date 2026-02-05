# Plano Concluído

✅ **Análise de Estratégias de Venda adicionada à auditoria de IA**

## Implementação Finalizada

1. **Banco de Dados** - 4 novas colunas em `lead_db`:
   - `used_offer` (boolean)
   - `offer_detail` (text)
   - `used_anchoring` (boolean)
   - `anchoring_detail` (text)

2. **Edge Function `analyze-lead`**:
   - Prompt atualizado para detectar ofertas/promoções e ancoragem
   - Schema de tool calling com novos campos
   - Payload de update inclui os novos campos
   - Nota do atendimento considera uso de estratégias de venda (+2 pontos máx)

3. **Edge Function `update-lead`**:
   - Suporte para persistir os 4 novos campos

4. **UI `LeadDetails.tsx`**:
   - Seção "Estratégias de Venda" no card de Compliance
   - Badges visuais (✅ Usou / Não usou)
   - Detalhes das estratégias exibidos quando disponíveis
