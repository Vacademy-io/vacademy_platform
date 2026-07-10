-- =============================================================================
-- V365: AI course creation (copilot) parametric tool pricing
-- -----------------------------------------------------------------------------
-- Attaches course outline + per-slide content generation to the academy-credits
-- parametric billing system (ai_tool_pricing, V321). Rates here are DB-tunable:
-- edit these rows (per institute pricing does not exist — rates are global) and
-- ai_service picks them up on the next request (no cache on the backend; the
-- admin FE caches /tool-pricing for 10 minutes).
--
-- IMPORTANT: these seeds MUST agree with DEFAULT_TOOL_PRICING in
-- ai_service/app/services/tool_cost_estimator.py (code fallback when a row is
-- missing/inactive). If you change a rate here, the code default stays as the
-- fallback only — the DB row wins while active.
--
-- AI_VIDEO / AI_SLIDES / AI_STORYBOOK slides are deliberately NOT seeded here:
-- the video pipeline already meters their actual usage (request types
-- video/tts/image/stock) with refund-on-failure semantics.
-- =============================================================================

INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    -- One outline generation (whole course tree, one large LLM call).
    ('course_outline',          'outline', 2, 0, 'flat', '{}'),
    -- Per generated slide, charged as max(flat, actual token cost).
    ('course_slide_document',   'content', 1, 0, 'flat', '{}'),
    ('course_slide_assessment', 'content', 1, 0, 'flat', '{}'),
    -- YouTube search (VIDEO) or search + code example (VIDEO_CODE).
    ('course_slide_video',      'content', 1, 0, 'flat', '{}'),
    -- Was only a code-side default until now (V321 never seeded it) — add the
    -- row so it becomes DB-tunable like every other tool.
    ('coding_question',         'coding_question', 4, 0, 'flat', '{}')
ON CONFLICT (tool_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Fix: 'coding_question' was charged (RequestType.CODING_QUESTION) but never
-- added to the ai_token_usage request_type CHECK — every coding-question charge
-- CheckViolates on the usage insert and is swallowed by best-effort billing, so
-- NO credits were deducted. Same trap as V102/V217/V225/V325/V345.
-- Expand-only: strict superset of V345.
-- Keep in sync with RequestType in ai_service/app/models/ai_token_usage.py.
-- -----------------------------------------------------------------------------
ALTER TABLE ai_token_usage DROP CONSTRAINT IF EXISTS ai_token_usage_request_type_check;

ALTER TABLE ai_token_usage ADD CONSTRAINT ai_token_usage_request_type_check
    CHECK (request_type IN (
        'outline',
        'image',
        'content',
        'video',
        'tts',
        'tts_premium',
        'embedding',
        'evaluation',
        'presentation',
        'conversation',
        'lecture',
        'course_content',
        'pdf_questions',
        'agent',
        'analytics',
        'copilot',
        'incident',
        'question_metadata',
        'stock',
        'avatar_video',
        'reels_preview',
        'ai_video',
        'assessment',
        'notes',
        'transcription',
        'call_intelligence',
        'coding_question'
    ));
