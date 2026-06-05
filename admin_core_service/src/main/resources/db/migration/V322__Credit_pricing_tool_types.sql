-- ================================================================================
-- V322: credit_pricing rows for the metered AI tools (academy-credits Phase 2)
--
-- Without these rows, `CreditService._get_pricing` silently falls back to the
-- `content` rate for these request_types. The real charge for these tools is
-- parametric (precomputed via ToolCostEstimator / ai_tool_pricing); these rows
-- price only the token-overage leg of max(parametric, actual) and keep usage
-- analytics bucketed by request_type. Must match DEFAULT_PRICING in
-- ai_service/app/services/credit_service.py.
-- ================================================================================

INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES
    ('assessment',    0.05, 0.00001, 0.05, 'tokens', 'AI assessment generation (parametric floor + token overage)', TRUE),
    ('notes',         0.05, 0.00001, 0.05, 'tokens', 'Auto study-notes from transcript (parametric floor + token overage)', TRUE),
    ('transcription', 0,    0,       0,    'none',   'Live-recording transcription (parametric per audio-minute, precomputed)', TRUE)
ON CONFLICT (request_type) DO NOTHING;
