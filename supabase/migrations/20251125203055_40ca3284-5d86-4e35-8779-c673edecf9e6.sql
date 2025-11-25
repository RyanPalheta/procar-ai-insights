-- Enable full CRUD on playbooks table
CREATE POLICY "Allow public insert on playbooks"
ON public.playbooks
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update on playbooks"
ON public.playbooks
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public delete on playbooks"
ON public.playbooks
FOR DELETE
TO public
USING (true);

-- Enable full CRUD on products table
CREATE POLICY "Allow public insert on products"
ON public.products
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update on products"
ON public.products
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public delete on products"
ON public.products
FOR DELETE
TO public
USING (true);