-- 2026-06-11 (2ª auditoria, legenda B — fase 1 da consolidação dos Vendedores):
-- "trazer a visão de atendimentos × agendamentos por canal (Kommo, Ligação
-- Receptiva, Presencial, etc.)". A própria equipe JÁ escreve o canal no note do
-- agendamento ("... RICARDO KOMMO", "... RICARDO TELEFONE") — o parse-note agora
-- extrai isso para a coluna channel, e o RPC dos vendedores devolve a quebra de
-- agendamentos por canal. Azul sem marcador = presencial (walk-in confirmado).

ALTER TABLE public.shopmonkey_appointment ADD COLUMN IF NOT EXISTS channel text;

DROP FUNCTION IF EXISTS public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz);
CREATE FUNCTION public.get_sellers_shopmonkey_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller          text,
  leads           bigint,
  agendamentos    bigint,
  walk_ins        bigint,
  orcamentos      bigint,
  vendas          bigint,
  receita_usd     numeric,
  conv_pct        numeric,
  taxa_agend_pct  numeric,
  agendamentos_por_canal jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lds AS (   -- total de leads por vendedor = lead_db_painel (= total da Kommo, sem duplicata/ausente)
    SELECT sales_person_id AS seller, count(*) AS leads
    FROM public.lead_db_painel
    WHERE sales_person_id IS NOT NULL AND sales_person_id <> ''
      AND (date_from IS NULL OR created_at >= date_from)
      AND (date_to   IS NULL OR created_at <  date_to)
    GROUP BY sales_person_id
  ),
  ag AS (
    SELECT public.canonical_seller(seller) AS seller,
           count(*) FILTER (WHERE color = 'green') AS agendamentos,
           count(*) FILTER (WHERE walk_in)         AS walk_ins
    FROM public.shopmonkey_appointment
    WHERE (date_from IS NULL OR start_date >= date_from)
      AND (date_to   IS NULL OR start_date <  date_to)
      AND public.canonical_seller(seller) IS NOT NULL
    GROUP BY 1
  ),
  agch AS (       -- agendamentos por canal de atendimento (marcador do note)
    SELECT public.canonical_seller(seller) AS seller,
           coalesce(channel, 'sem marcador') AS canal,
           count(*) AS n
    FROM public.shopmonkey_appointment
    WHERE (date_from IS NULL OR start_date >= date_from)
      AND (date_to   IS NULL OR start_date <  date_to)
      AND public.canonical_seller(seller) IS NOT NULL
    GROUP BY 1, 2
  ),
  agchj AS (
    SELECT seller, jsonb_object_agg(canal, n) AS agendamentos_por_canal
    FROM agch GROUP BY seller
  ),
  orc AS (
    SELECT public.canonical_seller((
             SELECT a.seller FROM public.shopmonkey_appointment a
             WHERE a.customer_id = o.customer_id AND a.seller IS NOT NULL
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1)) AS seller
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
             ORDER BY a.start_date DESC NULLS LAST LIMIT 1)) AS seller,
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
    SELECT seller FROM ag UNION SELECT seller FROM ol UNION SELECT seller FROM sl
  )
  SELECT s.seller,
         coalesce(lds.leads, 0)        AS leads,
         coalesce(ag.agendamentos, 0)  AS agendamentos,
         coalesce(ag.walk_ins, 0)      AS walk_ins,
         coalesce(ol.orcamentos, 0)    AS orcamentos,
         coalesce(sl.vendas, 0)        AS vendas,
         coalesce(sl.receita_usd, 0)   AS receita_usd,
         round(100.0 * coalesce(sl.vendas, 0)       / nullif(lds.leads, 0), 1) AS conv_pct,
         round(100.0 * coalesce(ag.agendamentos, 0) / nullif(lds.leads, 0), 1) AS taxa_agend_pct,
         coalesce(agchj.agendamentos_por_canal, '{}'::jsonb) AS agendamentos_por_canal
  FROM sellers s
  LEFT JOIN lds   ON lds.seller   = s.seller
  LEFT JOIN ag    ON ag.seller    = s.seller
  LEFT JOIN agchj ON agchj.seller = s.seller
  LEFT JOIN ol    ON ol.seller    = s.seller
  LEFT JOIN sl    ON sl.seller    = s.seller
  WHERE s.seller IS NOT NULL
  ORDER BY coalesce(lds.leads, 0) DESC, coalesce(sl.receita_usd, 0) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_sellers_shopmonkey_kpis(timestamptz, timestamptz) TO anon, authenticated;
