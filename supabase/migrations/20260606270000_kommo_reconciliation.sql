-- 2026-06-06: torna a CONVERGÊNCIA DA BASE (Kommo × lead_db) mensurável e
-- auditável de forma contínua. Guarda 1 snapshot/dia do gap medido pela edge
-- function reconcile-kommo e expõe o último via RPC para o card "Saúde da base".

CREATE TABLE IF NOT EXISTS public.kommo_reconciliation_snapshot (
  captured_day      date        NOT NULL PRIMARY KEY,  -- 1 snapshot por dia (upsert)
  captured_at       timestamptz NOT NULL DEFAULT now(),
  window_days       integer     NOT NULL,
  date_from         timestamptz NOT NULL,
  date_to           timestamptz NOT NULL,
  kommo_total       bigint      NOT NULL,
  dashboard_total   bigint      NOT NULL,
  dashboard_audited bigint,
  gap               bigint      NOT NULL,             -- leads na Kommo ausentes no painel
  gap_pct           numeric                            -- gap ÷ kommo_total (%)
);

CREATE INDEX IF NOT EXISTS idx_kommo_recon_captured_at
  ON public.kommo_reconciliation_snapshot (captured_at DESC);

ALTER TABLE public.kommo_reconciliation_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kommo_recon_select" ON public.kommo_reconciliation_snapshot;
CREATE POLICY "kommo_recon_select" ON public.kommo_reconciliation_snapshot
  FOR SELECT TO anon, authenticated USING (true);

-- Último snapshot + gap_pct de ~7 dias atrás (para o card mostrar a tendência).
CREATE OR REPLACE FUNCTION public.get_kommo_reconciliation()
RETURNS TABLE(
  captured_at       timestamptz,
  window_days       integer,
  kommo_total       bigint,
  dashboard_total   bigint,
  dashboard_audited bigint,
  gap               bigint,
  gap_pct           numeric,
  gap_pct_7d_ago    numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT * FROM public.kommo_reconciliation_snapshot
    ORDER BY captured_day DESC LIMIT 1
  )
  SELECT
    l.captured_at, l.window_days, l.kommo_total, l.dashboard_total,
    l.dashboard_audited, l.gap, l.gap_pct,
    (SELECT s.gap_pct
       FROM public.kommo_reconciliation_snapshot s
      WHERE s.captured_day <= l.captured_day - 7
      ORDER BY s.captured_day DESC LIMIT 1) AS gap_pct_7d_ago
  FROM latest l;
$$;

GRANT EXECUTE ON FUNCTION public.get_kommo_reconciliation() TO anon, authenticated;
