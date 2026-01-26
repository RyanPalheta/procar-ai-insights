-- Add objection_categories column for multi-select classification by AI
ALTER TABLE lead_db 
ADD COLUMN objection_categories text[] DEFAULT NULL;

COMMENT ON COLUMN lead_db.objection_categories IS 
'Array de categorias de objeção classificadas pela IA (multiselect): preco, tempo, distancia, financiamento, confianca, concorrencia, tecnica, indecisao';