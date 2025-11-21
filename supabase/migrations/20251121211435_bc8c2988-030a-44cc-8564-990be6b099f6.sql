-- Habilitar RLS nas tabelas products e playbooks
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Políticas para products: leitura pública
CREATE POLICY "Allow public read access on products" 
ON products 
FOR SELECT 
USING (true);

-- Políticas para playbooks: leitura pública
CREATE POLICY "Allow public read access on playbooks" 
ON playbooks 
FOR SELECT 
USING (true);