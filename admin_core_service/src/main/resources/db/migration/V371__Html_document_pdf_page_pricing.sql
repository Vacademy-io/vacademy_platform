-- =============================================================================
-- V371: HTML Document slide — per-page PDF grounding surcharge
-- -----------------------------------------------------------------------------
-- Grounding an HTML doc in an uploaded PDF costs real MathPix conversion money,
-- so charge a per-page surcharge on top of the generation charge. Deters
-- dumping very large PDFs. Billed on CREATE only (edits don't re-charge).
--
--   html_document_pdf = num_pages × 0.5 credits  (unit_field 'pages')
--
-- MUST agree with DEFAULT_TOOL_PRICING['html_document_pdf'] in
-- ai_service tool_cost_estimator.py. DB row wins while active; tune here.
-- =============================================================================

INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    ('html_document_pdf', 'content', 0, 0.5, 'pages', '{}')
ON CONFLICT (tool_key) DO NOTHING;
