-- 2026-06-24: UPSELL por vendedor (checklist secao M, itens 45-48). Card AMARELO.
-- Fonte A (preferida, decisao do usuario): shopmonkey_appointment.upsell text[] extraido
--   do note no formato (UPSELL: item1, item2) SEM "- Vendedor" no fim. Hoje 0 capturas
--   (equipe ainda nao adota o formato) -> card "preparado".
-- Fonte B (fallback): lead_db.has_upsell/upsell_value_estimate (IA), por sales_person_id.
CREATE OR REPLACE FUNCTION public.get_seller_upsell_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller          text,
  upsell_sm       bigint,
  upsell_ia       bigint,
  upsell_valor_ia numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sm AS (
    SELECT public.canonical_seller(seller) AS seller,
           COUNT(*) FILTER (WHERE cardinality(upsell) > 0) AS upsell_sm
    FROM public.shopmonkey_appointment
    WHERE (date_from IS NULL OR start_date >= date_from)
      AND (date_to   IS NULL OR start_date <  date_to)
      AND public.canonical_seller(seller) IS NOT NULL
    GROUP BY 1
  ),
  ia AS (
    SELECT public.canonical_seller(sales_person_id) AS seller,
           COUNT(*) FILTER (WHERE has_upsell) AS upsell_ia,
           COALESCE(SUM(upsell_value_estimate) FILTER (WHERE has_upsell), 0) AS upsell_valor_ia
    FROM public.lead_db_painel
    WHERE (date_from IS NULL OR created_at >= date_from)
      AND (date_to   IS NULL OR created_at <= date_to)
      AND public.canonical_seller(sales_person_id) IS NOT NULL
    GROUP BY 1
  )
  SELECT COALESCE(sm.seller, ia.seller)      AS seller,
         COALESCE(sm.upsell_sm, 0)           AS upsell_sm,
         COALESCE(ia.upsell_ia, 0)           AS upsell_ia,
         COALESCE(ia.upsell_valor_ia, 0)     AS upsell_valor_ia
  FROM sm FULL OUTER JOIN ia ON sm.seller = ia.seller
  ORDER BY COALESCE(ia.upsell_ia, 0) DESC, COALESCE(sm.upsell_sm, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_upsell_kpis(timestamptz, timestamptz) TO anon, authenticated;
