-- 2026-06-06: cotações REAIS por vendedor = orçamentos do ShopMonkey.
-- A auditoria diz "Cotações(dia)=1 quando Ricardo fez dezenas de orçamentos". O
-- chat (lead_db.lead_price) capta pouquíssimas cotações e quase sempre sob a conta
-- genérica. A cotação real é um ORDER do ShopMonkey (todo order nasce orçamento;
-- vira venda quando pago). Aqui contamos TODOS os orders por vendedor (atribuído
-- via customer_id -> agendamento -> seller, mesma lógica das vendas).

CREATE TABLE IF NOT EXISTS public.shopmonkey_order (
  id               text PRIMARY KEY,        -- ShopMonkey order id
  created_date     timestamptz,
  customer_id      text,
  paid             boolean,                 -- já pago (= venda)
  authorized       boolean,
  archived         boolean,
  total_cost_cents bigint,
  synced_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_order_created ON public.shopmonkey_order (created_date);

ALTER TABLE public.shopmonkey_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_shopmonkey_order" ON public.shopmonkey_order;
CREATE POLICY "read_shopmonkey_order" ON public.shopmonkey_order
  FOR SELECT TO anon, authenticated USING (true);

-- Recria a RPC com a coluna orcamentos (muda o tipo de retorno -> precisa DROP).
DROP FUNCTION IF EXISTS public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz);
CREATE FUNCTION public.get_sellers_shopmonkey_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller       text,
  agendamentos bigint,
  walk_ins     bigint,
  orcamentos   bigint,
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
  orc AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = o.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1
           )) AS seller
    FROM public.shopmonkey_order o
    WHERE (date_from IS NULL OR o.created_date >= date_from)
      AND (date_to   IS NULL OR o.created_date <  date_to)
      AND coalesce(o.archived, false) = false
  ),
  ol AS (SELECT seller, count(*) AS orcamentos FROM orc WHERE seller IS NOT NULL GROUP BY 1),
  sale AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = v.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1
           )) AS seller,
           v.paid_cost_cents
    FROM public.shopmonkey_sale v
    WHERE (date_from IS NULL OR v.fully_paid_date >= date_from)
      AND (date_to   IS NULL OR v.fully_paid_date <  date_to)
  ),
  sl AS (
    SELECT seller, count(*) AS vendas, round(sum(paid_cost_cents) / 100.0) AS receita_usd
    FROM sale WHERE seller IS NOT NULL GROUP BY 1
  ),
  sellers AS (
    SELECT seller FROM ag
    UNION SELECT seller FROM ol
    UNION SELECT seller FROM sl
  )
  SELECT s.seller,
         coalesce(ag.agendamentos, 0) AS agendamentos,
         coalesce(ag.walk_ins, 0)     AS walk_ins,
         coalesce(ol.orcamentos, 0)   AS orcamentos,
         coalesce(sl.vendas, 0)       AS vendas,
         coalesce(sl.receita_usd, 0)  AS receita_usd
  FROM sellers s
  LEFT JOIN ag ON ag.seller = s.seller
  LEFT JOIN ol ON ol.seller = s.seller
  LEFT JOIN sl ON sl.seller = s.seller
  WHERE s.seller IS NOT NULL
  ORDER BY coalesce(sl.receita_usd, 0) DESC, coalesce(ol.orcamentos, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz) TO anon, authenticated;
