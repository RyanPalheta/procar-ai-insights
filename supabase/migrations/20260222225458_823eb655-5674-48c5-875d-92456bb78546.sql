
-- Add Twilio and transcription columns to call_db
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS twilio_call_sid text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS from_number text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS to_number text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS call_status text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS recording_url text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS recording_sid text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS transcription_text text;
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS transcription_status text DEFAULT 'pending';
ALTER TABLE public.call_db ADD COLUMN IF NOT EXISTS ai_call_analysis jsonb;

-- Index for Twilio call SID lookups
CREATE INDEX IF NOT EXISTS idx_call_db_twilio_call_sid ON public.call_db (twilio_call_sid);
