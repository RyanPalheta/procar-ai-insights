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