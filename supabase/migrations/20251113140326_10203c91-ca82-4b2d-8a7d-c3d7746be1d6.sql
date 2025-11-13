-- Create lead_db table
CREATE TABLE IF NOT EXISTS public.lead_db (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_language TEXT,
  lead_price NUMERIC,
  sales_person_id TEXT,
  channel TEXT,
  sales_status TEXT,
  upsell_opportunity TEXT,
  lead_score NUMERIC,
  improvement_point TEXT,
  service_desired TEXT,
  last_ai_update TIMESTAMPTZ,
  ai_version TEXT,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Create call_db table
CREATE TABLE IF NOT EXISTS public.call_db (
  call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.lead_db(session_id) ON DELETE CASCADE,
  type TEXT,
  call_tag TEXT,
  call_result TEXT,
  call_duration INTEGER,
  ai_analysis_status TEXT,
  lead_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interaction_db table
CREATE TABLE IF NOT EXISTS public.interaction_db (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.lead_db(session_id) ON DELETE CASCADE,
  channel TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_text TEXT,
  sender_type TEXT,
  ai_tags TEXT[],
  sentiment TEXT,
  processed BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.lead_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_db ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_db ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (can be refined later based on auth)
CREATE POLICY "Allow public read access on lead_db" ON public.lead_db FOR SELECT USING (true);
CREATE POLICY "Allow public insert on lead_db" ON public.lead_db FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on lead_db" ON public.lead_db FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on call_db" ON public.call_db FOR SELECT USING (true);
CREATE POLICY "Allow public insert on call_db" ON public.call_db FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on interaction_db" ON public.interaction_db FOR SELECT USING (true);
CREATE POLICY "Allow public insert on interaction_db" ON public.interaction_db FOR INSERT WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_lead_db_sales_person ON public.lead_db(sales_person_id);
CREATE INDEX idx_lead_db_channel ON public.lead_db(channel);
CREATE INDEX idx_lead_db_status ON public.lead_db(sales_status);
CREATE INDEX idx_call_db_session ON public.call_db(session_id);
CREATE INDEX idx_interaction_db_session ON public.interaction_db(session_id);

-- Create function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead_db
CREATE TRIGGER update_lead_db_timestamp
BEFORE UPDATE ON public.lead_db
FOR EACH ROW
EXECUTE FUNCTION update_last_updated();