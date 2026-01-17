-- Criar tabela para histórico de alterações do lead
CREATE TABLE public.lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id integer NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text DEFAULT 'sistema',
  change_source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Allow public read on lead_history" ON public.lead_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on lead_history" ON public.lead_history FOR INSERT WITH CHECK (true);

-- Índice para busca rápida por session_id
CREATE INDEX idx_lead_history_session_id ON public.lead_history(session_id);
CREATE INDEX idx_lead_history_created_at ON public.lead_history(created_at DESC);