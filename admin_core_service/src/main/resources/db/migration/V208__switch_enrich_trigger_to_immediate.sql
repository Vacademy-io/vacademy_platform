-- ============================================================================
-- Switch the audience-response center-defaults trigger from DEFERRED to IMMEDIATE
-- ============================================================================
-- V207 used a DEFERRED CONSTRAINT TRIGGER that fires at transaction commit.
-- This is too late: submitLead() reads custom field values (via
-- buildCustomFieldMapForEmail) and dispatches the workflow BEFORE the transaction
-- commits, so the Day 1 workflow received empty values for Schedule Link etc.
--
-- An IMMEDIATE AFTER INSERT ROW trigger fires as soon as the "center name" row
-- is inserted. Defaults are then visible to the subsequent read inside the same
-- transaction, and the workflow receives the enriched values.
--
-- Trade-off: if the user supplies BOTH "center name" AND a center-specific field
-- (e.g. a custom Schedule Link) AND the "center name" INSERT happens before that
-- other INSERT in the saveAll batch, the trigger will write a default before the
-- user's value is inserted. Downstream reads that bucket duplicates via first-wins
-- (buildCustomFieldMapForEmail) may pick either. This is an edge case for the
-- shareable-link / CSV flows because users normally leave center-specific fields
-- blank; the webhook path is unaffected because FormWebhookService injects
-- defaults before calling submitLeadFromFormWebhook.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enrich_audience_response_defaults ON custom_field_values;

CREATE TRIGGER trg_enrich_audience_response_defaults
AFTER INSERT ON custom_field_values
FOR EACH ROW
EXECUTE FUNCTION enrich_audience_response_with_center_defaults();
