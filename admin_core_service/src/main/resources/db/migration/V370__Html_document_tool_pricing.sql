-- =============================================================================
-- V369: HTML Document slide AI generation — parametric tool pricing
-- -----------------------------------------------------------------------------
-- Attaches the HTML Document slide's AI authoring endpoint
-- (POST /ai-service/html-doc/v1/generate) to academy-credits billing.
--
-- One generation OR conversational edit = one large creative-HTML LLM call
-- (pro model, up to ~32k output tokens). Priced FLAT per call, charged as
-- max(flat, actual token cost). request_type 'content' already exists.
--
-- MUST agree with DEFAULT_TOOL_PRICING['html_document'] in
-- ai_service/app/services/tool_cost_estimator.py (code fallback). The DB row
-- wins while active; edit flat_base_credits here to re-tune globally.
-- =============================================================================

INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    ('html_document', 'content', 3, 0, 'flat', '{}')
ON CONFLICT (tool_key) DO NOTHING;
