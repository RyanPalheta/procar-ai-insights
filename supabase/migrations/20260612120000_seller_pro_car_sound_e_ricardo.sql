-- 2026-06-12 (decisao Pro Car): o Ricardo opera DOIS identificadores na Kommo —
-- o vendedor "Ricardo" (CF 1823653) E o usuario generico "Pro Car Sound &
-- Security" (o responsible_user default, por onde entram os leads de chat/WhatsApp
-- que ele atende). Sao a MESMA pessoa. Por isso a aba Vendedores deve UNIFICAR os
-- dois sob o nome "Ricardo" (e nao tratar a conta como "sem vendedor").
--
-- canonical_seller passa a mapear "%sound%security%" -> 'Ricardo', entao os leads
-- da conta generica colapsam no MESMO grupo do CF "Ricardo" nas RPCs de vendedor.
-- Correcao em tempo de leitura, sem reescrever dados; reversivel. Espelhar a regra
-- em supabase/functions/_shared/canonical-seller.ts.
--
-- OBS (esperado): isso faz o Ricardo concentrar a maioria dos leads atribuidos —
-- sao os leads de chat/WhatsApp, que historicamente caem todos na conta generica.
-- E o resultado correto SE o Ricardo e o closer do canal online.

CREATE OR REPLACE FUNCTION public.canonical_seller(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN lower(raw) ~ 'registrad|no notes' THEN NULL
    WHEN lower(raw) LIKE '%sound%security%' THEN 'Ricardo'  -- conta generica = o proprio Ricardo (decisao Pro Car 2026-06-12)
    WHEN lower(raw) LIKE '%henrique%' THEN 'Henrique'
    WHEN lower(raw) LIKE '%ricar%'    THEN 'Ricardo'   -- ricardo, ricarod
    WHEN lower(raw) LIKE '%matheus%'  THEN 'Matheus'
    WHEN lower(raw) LIKE '%gabriel%'  THEN 'Gabriel'
    WHEN lower(raw) LIKE '%vitor%' OR lower(raw) LIKE '%vítor%' THEN 'Vitor'
    WHEN lower(raw) LIKE '%joao pedro%' OR lower(raw) LIKE '%joão pedro%' THEN 'JP'
    WHEN lower(btrim(raw)) IN ('jp','joao','joão') THEN 'JP'
    WHEN lower(raw) LIKE '%doug%'     THEN 'Doug'      -- "Doug - Pro Car" etc.
    WHEN lower(raw) LIKE '%maick%'    THEN 'Maick'
    WHEN lower(raw) LIKE '%maestro%'  THEN 'Maestro'
    ELSE initcap(btrim(raw))
  END
$$;
