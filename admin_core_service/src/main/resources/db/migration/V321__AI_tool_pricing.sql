-- ================================================================================
-- V321: AI Tool Pricing — parametric, predictable per-tool credit rates
--
-- Backs the admin-facing cost preview ("≈ N credits") and (Phase 2) the floor of
-- the actual charge for AI tools. Unlike `credit_pricing` (token-based USD→credit
-- conversion), these rates are expressed DIRECTLY in credits and computed from a
-- few user-controlled inputs, so the number is stable and explainable:
--   "10 questions = 10 credits", "55-min recording ≈ 28 credits".
--
-- Read by ai_service `ToolCostEstimator`. DB-tunable without a deploy (same
-- philosophy as V252 credit_rate_config). If a row is missing, ai_service falls
-- back to DEFAULT_TOOL_PRICING in code, so this seed and that dict must agree.
--
-- unit_field drives the formula:
--   questions     → flat_base + num_questions × per_unit (+ images × image_unit_credits)
--   audio_minutes → flat_base + minutes × per_unit, floored at params.min_credits
--   chars         → flat_base + ceil(transcript_chars / params.chars_per_unit) × per_unit
--   flat          → flat_base (+ params.questions_add / homework_add toggles)
-- ================================================================================

CREATE TABLE IF NOT EXISTS ai_tool_pricing (
    tool_key          VARCHAR(64)   PRIMARY KEY,
    request_type      VARCHAR(64)   NOT NULL,
    flat_base_credits DECIMAL(10,4) NOT NULL DEFAULT 0,
    per_unit_credits  DECIMAL(10,4) NOT NULL DEFAULT 0,
    unit_field        VARCHAR(32)   NOT NULL,
    params_json       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ai_tool_pricing_flat_base_nonneg CHECK (flat_base_credits >= 0),
    CONSTRAINT ai_tool_pricing_per_unit_nonneg  CHECK (per_unit_credits >= 0),
    CONSTRAINT ai_tool_pricing_unit_field_valid
        CHECK (unit_field IN ('questions', 'audio_minutes', 'chars', 'flat'))
);

-- Seed starter rates (idempotent). Must match DEFAULT_TOOL_PRICING in
-- ai_service/app/services/tool_cost_estimator.py.
INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    ('assessment',    'assessment',    0, 1,   'questions',     '{"image_unit_credits": 0.5}'::jsonb),
    ('transcription', 'transcription', 0, 0.5, 'audio_minutes', '{"min_credits": 2}'::jsonb),
    ('notes',         'notes',         3, 1,   'chars',         '{"chars_per_unit": 2000}'::jsonb),
    ('lecture',       'lecture',       4, 0,   'flat',          '{"questions_add": 2, "homework_add": 2}'::jsonb)
ON CONFLICT (tool_key) DO NOTHING;
