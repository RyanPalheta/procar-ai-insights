-- Primeiro, remover as políticas RLS
DROP POLICY IF EXISTS "Allow public read access on lead_db" ON lead_db;
DROP POLICY IF EXISTS "Allow public insert on lead_db" ON lead_db;
DROP POLICY IF EXISTS "Allow public update on lead_db" ON lead_db;
DROP POLICY IF EXISTS "Allow public read access on call_db" ON call_db;
DROP POLICY IF EXISTS "Allow public insert on call_db" ON call_db;
DROP POLICY IF EXISTS "Allow public read access on interaction_db" ON interaction_db;
DROP POLICY IF EXISTS "Allow public insert on interaction_db" ON interaction_db;

-- Remover foreign keys
ALTER TABLE call_db DROP CONSTRAINT IF EXISTS call_db_session_id_fkey;
ALTER TABLE interaction_db DROP CONSTRAINT IF EXISTS interaction_db_session_id_fkey;

-- Deletar todos os dados das tabelas
DELETE FROM interaction_db;
DELETE FROM call_db;
DELETE FROM lead_db;

-- Alterar session_id de UUID para integer
ALTER TABLE lead_db 
  ALTER COLUMN session_id DROP DEFAULT,
  ALTER COLUMN session_id TYPE integer USING NULL;

ALTER TABLE call_db 
  ALTER COLUMN session_id TYPE integer USING NULL;

ALTER TABLE interaction_db 
  ALTER COLUMN session_id TYPE integer USING NULL;

-- Tornar session_id NOT NULL e primary key em lead_db
ALTER TABLE lead_db 
  ALTER COLUMN session_id SET NOT NULL,
  DROP CONSTRAINT IF EXISTS lead_db_pkey,
  ADD PRIMARY KEY (session_id);

-- Adicionar foreign keys de volta
ALTER TABLE call_db 
  ADD CONSTRAINT call_db_session_id_fkey 
  FOREIGN KEY (session_id) 
  REFERENCES lead_db(session_id);

ALTER TABLE interaction_db 
  ADD CONSTRAINT interaction_db_session_id_fkey 
  FOREIGN KEY (session_id) 
  REFERENCES lead_db(session_id);

-- Recriar as políticas RLS
CREATE POLICY "Allow public read access on lead_db" 
  ON lead_db FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert on lead_db" 
  ON lead_db FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update on lead_db" 
  ON lead_db FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public read access on call_db" 
  ON call_db FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert on call_db" 
  ON call_db FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public read access on interaction_db" 
  ON interaction_db FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert on interaction_db" 
  ON interaction_db FOR INSERT 
  WITH CHECK (true);