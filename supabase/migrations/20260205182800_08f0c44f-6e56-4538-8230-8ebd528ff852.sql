-- Add objection_overcome column to lead_db
ALTER TABLE lead_db 
ADD COLUMN objection_overcome boolean DEFAULT null;

COMMENT ON COLUMN lead_db.objection_overcome IS 
  'Indica se a objeção do cliente foi contornada pelo vendedor (análise de IA)';