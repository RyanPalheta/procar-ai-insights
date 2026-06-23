-- 2026-06-23 (Pro Car): dois acertos na atribuicao de vendedor.
-- 1) "Maestro" e um PRODUTO vendido (aparece no trecho <PRODUTO> do note do
--    agendamento), NAO um vendedor -> canonical_seller retorna NULL.
-- 2) "Fabricio" E vendedor (slot <VENDEDOR> do note, ex.: "EN - CARPLAY - FABRICIO")
--    -> reconhecido como 'Fabricio'.
-- Espelha o codigo: src/lib/sellers.ts, supabase/functions/_shared/canonical-seller.ts
-- e parse-note.ts (SELLERS). Demais ramos inalterados.

CREATE OR REPLACE FUNCTION public.canonical_seller(raw text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN lower(raw) ~ 'registrad|no notes' THEN NULL
    WHEN lower(raw) LIKE '%sound%security%' THEN 'Ricardo'
    WHEN lower(raw) LIKE '%henrique%' THEN 'Henrique'
    WHEN lower(raw) LIKE '%ricar%'    THEN 'Ricardo'
    WHEN lower(raw) LIKE '%matheus%'  THEN 'Matheus'
    WHEN lower(raw) LIKE '%gabriel%'  THEN 'Gabriel'
    WHEN lower(raw) LIKE '%vitor%' OR lower(raw) LIKE '%vítor%' THEN 'Vitor'
    WHEN lower(raw) LIKE '%joao pedro%' OR lower(raw) LIKE '%joão pedro%' THEN 'JP'
    WHEN lower(btrim(raw)) IN ('jp','joao','joão') THEN 'JP'
    WHEN lower(raw) LIKE '%doug%'     THEN 'Doug'
    WHEN lower(raw) LIKE '%maick%'    THEN 'Maick'
    WHEN lower(raw) LIKE '%fabricio%' OR lower(raw) LIKE '%fabrício%' THEN 'Fabricio'
    WHEN lower(raw) LIKE '%maestro%'  THEN NULL  -- produto, nao vendedor
    ELSE initcap(btrim(raw))
  END
$function$;

-- O agendamento que estava com seller='maestro' (note "EN - CARPLAY - FABRICIO /
-- SEM MAESTRO") passa a ser do Fabricio: re-deriva o valor cru armazenado.
UPDATE public.shopmonkey_appointment
   SET seller = 'fabricio'
 WHERE lower(seller) = 'maestro'
   AND lower(note) LIKE '%fabricio%';
