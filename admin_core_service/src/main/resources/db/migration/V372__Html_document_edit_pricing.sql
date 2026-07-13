-- =============================================================================
-- V370: HTML Document slide — split create vs edit pricing
-- -----------------------------------------------------------------------------
-- A full CREATE (first generation) costs more than a conversational EDIT that
-- reuses the existing page, so they are priced separately:
--   html_document       (create) = 15 credits
--   html_document_edit  (edit)   =  3 credits
--
-- V369 seeded html_document at 3; bump it to 15 and add the edit key.
-- MUST agree with DEFAULT_TOOL_PRICING in ai_service tool_cost_estimator.py.
-- =============================================================================

UPDATE ai_tool_pricing
   SET flat_base_credits = 15
 WHERE tool_key = 'html_document';

INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    ('html_document_edit', 'content', 3, 0, 'flat', '{}')
ON CONFLICT (tool_key) DO NOTHING;
