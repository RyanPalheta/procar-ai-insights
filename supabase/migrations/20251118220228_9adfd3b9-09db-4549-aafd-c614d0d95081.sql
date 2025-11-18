-- Adicionar políticas RLS para DELETE nas tabelas

-- Permitir DELETE em call_db
CREATE POLICY "Allow public delete on call_db"
ON public.call_db
FOR DELETE
TO public
USING (true);

-- Permitir DELETE em interaction_db
CREATE POLICY "Allow public delete on interaction_db"
ON public.interaction_db
FOR DELETE
TO public
USING (true);

-- Permitir DELETE em lead_db
CREATE POLICY "Allow public delete on lead_db"
ON public.lead_db
FOR DELETE
TO public
USING (true);