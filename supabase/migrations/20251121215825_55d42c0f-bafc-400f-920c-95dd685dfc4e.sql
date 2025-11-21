-- Create audit_logs table for system event tracking
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id INTEGER,
  event_type TEXT NOT NULL,
  function_name TEXT,
  event_details JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  execution_time_ms INTEGER,
  error_message TEXT
);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (audit logs should be visible to all)
CREATE POLICY "Allow public read access on audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (true);

-- Create policy for public insert (edge functions need to log)
CREATE POLICY "Allow public insert on audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_session_id ON public.audit_logs(session_id);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type);