-- Criar tabela de produtos
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text UNIQUE NOT NULL,
  product_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_type ON products(product_type);

-- Criar tabela de playbooks
CREATE TABLE playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  steps jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_playbooks_type ON playbooks(product_type);

-- Adicionar campos de análise de playbook ao lead_db
ALTER TABLE lead_db 
ADD COLUMN IF NOT EXISTS playbook_compliance_score numeric,
ADD COLUMN IF NOT EXISTS playbook_steps_completed text[],
ADD COLUMN IF NOT EXISTS playbook_steps_missing text[],
ADD COLUMN IF NOT EXISTS playbook_violations text;