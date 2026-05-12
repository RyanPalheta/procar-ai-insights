-- Cleanup string-literal "null" pollution in lead_db.service_desired and
-- lead_db.services_detected. Caused by analyze-lead occasionally receiving
-- the string "null" from Gemini function-calling and writing it through
-- matchProduct() unfiltered. Sync to Kommo silently dropped these because
-- PRODUCT_ENUM has no key matching "null", so the "Produto de interesse"
-- field stayed empty in CRM.
--
-- The analyze-lead fix (filter invalid sentinel tokens) prevents new rows.
-- This migration cleans the existing affected rows so a follow-up
-- scan-services run can repopulate them from interaction_db keywords.

-- Always-safe: service_desired exists on lead_db from earlier migrations.
UPDATE public.lead_db
SET service_desired = NULL
WHERE lower(trim(service_desired)) IN ('null', 'undefined', 'n/a', 'none', '');

-- Conditional: services_detected was added manually on the legacy DB and is
-- not guaranteed to exist on a freshly-migrated project. Skip cleanly if absent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_db'
      AND column_name = 'services_detected'
  ) THEN
    -- Null out arrays consisting entirely of sentinel tokens
    EXECUTE $sql$
      UPDATE public.lead_db
      SET services_detected = NULL
      WHERE services_detected IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM unnest(services_detected) s
          WHERE lower(trim(s)) NOT IN ('null', 'undefined', 'n/a', 'none', '')
        );
    $sql$;

    -- Strip sentinels from arrays that also contain real services
    EXECUTE $sql$
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
    $sql$;
  END IF;
END $$;
