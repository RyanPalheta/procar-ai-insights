-- 2026-06-24: LIGACOES de follow-up por vendedor (checklist secao I, itens 29-31).
-- Card AMARELO. A anotacao pedia TAREFAS da Kommo (nao ingeridas) -> usamos o que existe:
-- ligacoes EFETIVAMENTE FEITAS (call_db), atribuidas ao vendedor DONO do lead
-- (call_db.session_id -> lead_db.sales_person_id -> canonical_seller). Direcao ATIVA
-- (saida = follow-up) replicando src/lib/calls.ts: from_number = telefone da loja.
CREATE OR REPLACE FUNCTION public.get_followup_calls_by_seller(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  seller         text,
  active_calls   bigint,
  followup_calls bigint,
  leads_called   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.canonical_seller(l.sales_person_id) AS seller,
         COUNT(*) FILTER (WHERE right(regexp_replace(c.from_number, '\D', '', 'g'), 10) = '7816053526') AS active_calls,
         COUNT(*) FILTER (WHERE c.ai_call_analysis->>'call_outcome' = 'followup') AS followup_calls,
         COUNT(DISTINCT c.session_id) AS leads_called
  FROM public.call_db c
  JOIN public.lead_db_painel l ON l.session_id = c.session_id
  WHERE c.type = 'phone'
    AND (date_from IS NULL OR c.created_at >= date_from)
    AND (date_to   IS NULL OR c.created_at <= date_to)
    AND public.canonical_seller(l.sales_person_id) IS NOT NULL
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_calls_by_seller(timestamptz, timestamptz) TO anon, authenticated;
