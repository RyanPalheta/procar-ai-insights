-- 2026-06-24: ABSOLUTO (checklist secao G, itens 25-27). Card AMARELO PREPARADO.
-- Decisao do usuario: "absoluto" e capturado via WEBHOOK de mensagem da Kommo/WhatsApp
-- que aplica uma TAG no lead; o sync-kommo le essa tag para lead_db.is_absoluto.
-- A coluna/RPC ficam prontas; enquanto o webhook nao estiver ativo, os cards ficam em 0.
-- NAO vem da nota do ShopMonkey (la is_absoluto=0).

ALTER TABLE public.lead_db ADD COLUMN IF NOT EXISTS is_absoluto boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_lead_db_absoluto ON public.lead_db (is_absoluto) WHERE is_absoluto;

-- Consulta lead_db direto com as exclusoes do painel (is_duplicate/kommo_absent), porque
-- a VIEW lead_db_painel tem lista fixa de colunas e ainda nao expoe is_absoluto.
CREATE OR REPLACE FUNCTION public.get_absoluto_kpis(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'absoluto_total', (
      SELECT COUNT(*) FROM public.lead_db
      WHERE is_absoluto AND is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE
        AND (date_from IS NULL OR created_at >= date_from)
        AND (date_to   IS NULL OR created_at <= date_to)
    ),
    'absoluto_agendamentos', (
      SELECT COUNT(*) FROM public.lead_db
      WHERE is_absoluto AND is_duplicate IS NOT TRUE AND kommo_absent IS NOT TRUE
        AND (lower(COALESCE(sales_status, '')) LIKE '%agendamento%' OR lower(COALESCE(sales_status, '')) LIKE '%ganha%')
        AND (date_from IS NULL OR created_at >= date_from)
        AND (date_to   IS NULL OR created_at <= date_to)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_absoluto_kpis(timestamptz, timestamptz) TO anon, authenticated;
