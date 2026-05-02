-- V225: Expand ai_token_usage CHECK constraints for the Host (avatar) feature
--       AND fix a pre-existing TTS deduction failure.
--
-- TWO ISSUES:
--
-- 1) (NEW) The Host (avatar) feature deducts credits using
--    `request_type='avatar_video'` (Python enum: RequestType.AVATAR_VIDEO,
--    added in this round). The current ai_token_usage_request_type_check
--    constraint (last set in V217) doesn't include this value, so per-shot
--    avatar deduction would CheckViolation in production once host runs.
--
-- 2) (PRE-EXISTING) TTS deduction has been silently failing whenever
--    `tts_provider='premium'` resolves to Sarvam (Indian languages) or
--    Google Cloud TTS, because both routes set
--    `api_provider='google_tts'` (Python enum: ApiProvider.GOOGLE_TTS).
--    The original V71 constraint only allowed ('openai', 'gemini'), so
--    every premium-TTS row has been throwing
--    `ai_token_usage_api_provider_check` violations. Visible in
--    /Volumes/shreyash_ex/Vacademy/ai_pipeline.txt lines 212-216 + 237-241.
--    Since the deduction itself is wrapped in try/except, this manifests
--    as a silent revenue leak (TTS minutes not billed to institutes).
--    Fixing here while we're touching the same table.
--
-- Net effect after this migration: AVATAR_VIDEO deductions land cleanly
-- AND premium TTS deductions stop failing.

-- ── 1. request_type — add 'avatar_video' to the existing list ────────────
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
        'stock',
        'avatar_video'
    ));

COMMENT ON COLUMN ai_token_usage.request_type IS
    'Type of AI request: outline, image, content, video, tts, tts_premium, embedding, evaluation, presentation, conversation, lecture, course_content, pdf_questions, agent, analytics, copilot, stock, avatar_video';

-- ── 2. api_provider — add 'google_tts' to fix premium-TTS deductions ─────
ALTER TABLE ai_token_usage DROP CONSTRAINT IF EXISTS ai_token_usage_api_provider_check;

ALTER TABLE ai_token_usage ADD CONSTRAINT ai_token_usage_api_provider_check
    CHECK (api_provider IN (
        'openai',
        'gemini',
        'google_tts'
    ));

COMMENT ON COLUMN ai_token_usage.api_provider IS
    'AI provider: openai (default LLM/image path), gemini (image gen + Google LLMs), google_tts (premium TTS — Sarvam AI for Indian langs, Google Cloud TTS for global)';
