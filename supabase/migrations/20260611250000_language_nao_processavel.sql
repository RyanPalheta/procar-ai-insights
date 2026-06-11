-- 2026-06-11 (pedido Pro Car): no gráfico "Leads por Língua", separar quem ainda
-- pode ganhar idioma de quem NÃO PODE:
--   - "Sem idioma (ainda)"        = lead COM conversa no painel, idioma pendente
--                                   (backfill/IA ainda não rodou ou texto sem sinal).
--   - "Não pode ser processado"   = lead SEM conversa no painel — telefone (não há
--                                   chat) e espelhados da Kommo pelo sync-kommo cujas
--                                   mensagens nunca foram ingeridas (ex.: queda da
--                                   VPS 07–10/06, gap de ingestão).
-- O front precisa saber "este lead tem mensagens?". Todos os leads têm session_id
-- (o sync-kommo também preenche), então o sinal é EXISTS em interaction_db.
-- RPC enxuta: recebe os session_ids dos leads sem idioma e devolve quais têm chat.

CREATE INDEX IF NOT EXISTS idx_interaction_db_session_id
  ON public.interaction_db (session_id);

CREATE OR REPLACE FUNCTION public.get_sessions_with_chat(p_sessions integer[])
RETURNS integer[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT i.session_id), '{}')
  FROM interaction_db i
  WHERE i.session_id = ANY (p_sessions);
$$;

GRANT EXECUTE ON FUNCTION public.get_sessions_with_chat(integer[]) TO anon, authenticated;
