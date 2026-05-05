-- Cleanup string-literal "null" pollution in lead_db.service_desired and
-- lead_db.services_detected. Caused by analyze-lead occasionally receiving
-- the string "null" from Gemini function-calling and writing it through
-- matchProduct() unfiltered. Sync to Kommo silently dropped these because
-- PRODUCT_ENUM has no key matching "null", so the "Produto de interesse"
-- field stayed empty in CRM.
--
-- The analyze-lead fix (filter invalid sentinel tokens) prevents new rows.
-- This migration cleans the existing 63 affected rows so a follow-up
-- scan-services run can repopulate them from interaction_db keywords.

UPDATE public.lead_db
SET service_desired = NULL
WHERE lower(trim(service_desired)) IN ('null', 'undefined', 'n/a', 'none', '');

UPDATE public.lead_db
SET services_detected = NULL
WHERE services_detected IS NOT NULL
  AND (
    -- Array consists entirely of sentinel tokens
    NOT EXISTS (
      SELECT 1 FROM unnest(services_detected) s
      WHERE lower(trim(s)) NOT IN ('null', 'undefined', 'n/a', 'none', '')
    )
  );

-- Keep arrays that mix real services with sentinels — strip just the sentinels.
UPDATE public.lead_db
SET services_detected = ARRAY(
  SELECT s FROM unnest(services_detected) s
  WHERE lower(trim(s)) NOT IN ('null', 'undefined', 'n/a', 'none', '')
)
WHERE services_detected IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(services_detected) s
    WHERE lower(trim(s)) IN ('null', 'undefined', 'n/a', 'none', '')
  );
