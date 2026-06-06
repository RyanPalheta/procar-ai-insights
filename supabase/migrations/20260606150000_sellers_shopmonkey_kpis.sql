-- 2026-06-06: aba "Vendedores" REAL a partir do ShopMonkey.
-- A auditoria aponta a aba Vendedores como NÃO CONFIÁVEL ("hoje só o Ricardo está
-- cadastrado"). O vendedor NÃO existe como dado estruturado (na Kommo o
-- responsible_user é 100% uma conta genérica; no ShopMonkey technicians vem vazio).
-- Ele só aparece no TEXTO do note do agendamento, de onde o parseNote (código puro)
-- o extrai com ~93% de cobertura -> shopmonkey_appointment.seller.
-- Aqui agregamos agendamentos / walk-ins / vendas / receita por VENDEDOR, separando
-- AGENDAMENTO (appointment verde) de VENDA (order pago) — exatamente como pede a auditoria.

-- canonical_seller: normaliza o nome (parseNote grava minúsculo; a Kommo tem
-- variações de caixa e typos). Sentinela ("Não registrado no notes…")/vazio -> NULL.
CREATE OR REPLACE FUNCTION public.canonical_seller(raw text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL
    WHEN lower(raw) ~ 'registrad|no notes' THEN NULL
    WHEN lower(raw) LIKE '%henrique%' THEN 'Henrique'
    WHEN lower(raw) LIKE '%ricar%'    THEN 'Ricardo'   -- ricardo, ricarod
    WHEN lower(raw) LIKE '%matheus%'  THEN 'Matheus'
    WHEN lower(raw) LIKE '%gabriel%'  THEN 'Gabriel'
    WHEN lower(raw) LIKE '%vitor%' OR lower(raw) LIKE '%vítor%' THEN 'Vitor'
    WHEN lower(btrim(raw)) IN ('jp','joao pedro','joão pedro','joao','joão') THEN 'JP'
    WHEN lower(raw) LIKE '%maestro%'  THEN 'Maestro'
    ELSE initcap(btrim(raw))
  END
$$;

-- get_sellers_shopmonkey_kpis: por vendedor, no período (date_from/date_to, mesmo
-- contrato das demais RPCs). Venda atribuída ao vendedor via customer_id do
-- agendamento (cobertura ~91%). Datas: agendamento por start_date, venda por
-- fully_paid_date. Receita em USD = soma do valor pago.
CREATE OR REPLACE FUNCTION public.get_sellers_shopmonkey_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller       text,
  agendamentos bigint,
  walk_ins     bigint,
  vendas       bigint,
  receita_usd  numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ag AS (
    SELECT public.canonical_seller(seller) AS seller,
           count(*) FILTER (WHERE color = 'green') AS agendamentos,
           count(*) FILTER (WHERE walk_in)         AS walk_ins
    FROM public.shopmonkey_appointment
    WHERE (date_from IS NULL OR start_date >= date_from)
      AND (date_to   IS NULL OR start_date <  date_to)
      AND public.canonical_seller(seller) IS NOT NULL
    GROUP BY 1
  ),
  sale AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = v.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST
             LIMIT 1
           )) AS seller,
           v.paid_cost_cents
    FROM public.shopmonkey_sale v
    WHERE (date_from IS NULL OR v.fully_paid_date >= date_from)
      AND (date_to   IS NULL OR v.fully_paid_date <  date_to)
  ),
  sl AS (
    SELECT seller, count(*) AS vendas, round(sum(paid_cost_cents) / 100.0) AS receita_usd
    FROM sale WHERE seller IS NOT NULL GROUP BY 1
  )
  SELECT coalesce(ag.seller, sl.seller)  AS seller,
         coalesce(ag.agendamentos, 0)    AS agendamentos,
         coalesce(ag.walk_ins, 0)        AS walk_ins,
         coalesce(sl.vendas, 0)          AS vendas,
         coalesce(sl.receita_usd, 0)     AS receita_usd
  FROM ag FULL OUTER JOIN sl ON ag.seller = sl.seller
  ORDER BY coalesce(sl.receita_usd, 0) DESC, coalesce(ag.agendamentos, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.canonical_seller(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz) TO anon, authenticated;
