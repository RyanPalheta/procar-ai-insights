-- Add lead intent and objection fields to lead_db
ALTER TABLE public.lead_db
ADD COLUMN lead_intent text,
ADD COLUMN has_objection boolean DEFAULT false,
ADD COLUMN objection_detail text;