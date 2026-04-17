-- ============================================================================
-- Trigger: Auto-enrich audience_response custom_field_values with center defaults
-- ============================================================================
-- When a lead is submitted via shareable link, CSV upload, or webhook, and the
-- "center name" custom field value is saved, this trigger looks up the matching
-- form_webhook_connector (by audience + center name in default_values_json) and
-- auto-inserts any missing default values (Schedule Link, Location Link,
-- School Phone, PM Name, etc.).
--
-- Key design decisions:
--   1. Uses a DEFERRED CONSTRAINT TRIGGER that fires at transaction commit time
--      (not during statement execution). This ensures all user-provided inserts
--      are visible before enrichment runs, so user values always win.
--   2. Only fires for AUDIENCE_RESPONSE rows with field_name = "center name"
--      (case-insensitive) — no impact on other custom_field_values usage.
--   3. No-op when form_webhook_connector has no default_values_json (existing
--      Zoho/referral connectors unaffected).
--   4. Safe against recursion: defaults inserted are for OTHER fields, not
--      "center name", so the trigger's own INSERTs do not trigger another
--      enrichment cycle.
-- ============================================================================

CREATE OR REPLACE FUNCTION enrich_audience_response_with_center_defaults()
RETURNS TRIGGER AS $$
DECLARE
    v_field_name         TEXT;
    v_audience_id        TEXT;
    v_default_json       JSONB;
    v_default_key        TEXT;
    v_default_value      TEXT;
    v_target_field_id    VARCHAR(36);
    v_existing_value     TEXT;
BEGIN
    -- Only process AUDIENCE_RESPONSE custom field values
    IF NEW.source_type IS DISTINCT FROM 'AUDIENCE_RESPONSE' THEN
        RETURN NULL;
    END IF;

    -- Look up the field name for the inserted custom_field_id
    SELECT cf.field_name INTO v_field_name
    FROM custom_fields cf
    WHERE cf.id = NEW.custom_field_id;

    -- Only act when the "center name" field is being inserted (case-insensitive)
    IF v_field_name IS NULL OR LOWER(TRIM(v_field_name)) <> 'center name' THEN
        RETURN NULL;
    END IF;

    -- Skip if the inserted value is empty
    IF NEW.value IS NULL OR TRIM(NEW.value) = '' THEN
        RETURN NULL;
    END IF;

    -- Find the audience_id for this response
    SELECT ar.audience_id INTO v_audience_id
    FROM audience_response ar
    WHERE ar.id = NEW.source_id;

    IF v_audience_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find matching connector whose default_values_json has the same center name
    -- (case-insensitive). No-op if no connector has default_values_json.
    SELECT fwc.default_values_json::jsonb INTO v_default_json
    FROM form_webhook_connector fwc
    WHERE fwc.audience_id = v_audience_id
      AND fwc.is_active = true
      AND fwc.default_values_json IS NOT NULL
      AND LOWER(TRIM(fwc.default_values_json::jsonb->>'center name')) = LOWER(TRIM(NEW.value))
    LIMIT 1;

    IF v_default_json IS NULL THEN
        RETURN NULL;
    END IF;

    -- Since this is a DEFERRED trigger, all user-provided inserts in the same
    -- transaction are visible here. We only insert defaults for fields with
    -- NO existing non-empty value.
    FOR v_default_key, v_default_value IN
        SELECT key, value FROM jsonb_each_text(v_default_json)
    LOOP
        -- Skip the center name itself (already inserted, this is our trigger row)
        IF LOWER(TRIM(v_default_key)) = 'center name' THEN
            CONTINUE;
        END IF;

        -- Skip empty default values
        IF v_default_value IS NULL OR TRIM(v_default_value) = '' THEN
            CONTINUE;
        END IF;

        -- Find the custom_field_id matching this field name for this audience
        SELECT cf.id INTO v_target_field_id
        FROM custom_fields cf
        JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
        WHERE LOWER(TRIM(cf.field_name)) = LOWER(TRIM(v_default_key))
          AND icf.type = 'AUDIENCE_FORM'
          AND icf.type_id = v_audience_id
          AND icf.status = 'ACTIVE'
        LIMIT 1;

        IF v_target_field_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Check for existing value for this field on this response
        SELECT cfv.value INTO v_existing_value
        FROM custom_field_values cfv
        WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
          AND cfv.source_id = NEW.source_id
          AND cfv.custom_field_id = v_target_field_id
        LIMIT 1;

        -- User-provided value takes precedence — only fill if missing or empty
        IF v_existing_value IS NOT NULL AND TRIM(v_existing_value) <> '' THEN
            CONTINUE;
        END IF;

        IF v_existing_value IS NULL THEN
            INSERT INTO custom_field_values (id, custom_field_id, source_type, source_id, value)
            VALUES (gen_random_uuid()::text, v_target_field_id, 'AUDIENCE_RESPONSE', NEW.source_id, v_default_value);
        ELSE
            -- Row exists but value is empty — update it
            UPDATE custom_field_values
            SET value = v_default_value
            WHERE source_type = 'AUDIENCE_RESPONSE'
              AND source_id = NEW.source_id
              AND custom_field_id = v_target_field_id;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_enrich_audience_response_defaults ON custom_field_values;

-- DEFERRED CONSTRAINT TRIGGER: fires at transaction commit, after all user inserts
CREATE CONSTRAINT TRIGGER trg_enrich_audience_response_defaults
AFTER INSERT ON custom_field_values
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enrich_audience_response_with_center_defaults();
