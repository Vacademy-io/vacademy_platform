-- ================================================================================
-- V325: Expand ai_token_usage.request_type CHECK for the academy-credits tools
--
-- BUG: the parametric tool billing (assessment / notes / transcription) writes an
-- ai_token_usage row with request_type='assessment'|'notes'|'transcription', but
-- the CHECK constraint (last set in V225) doesn't allow those values, so every
-- such row throws ai_token_usage_request_type_check → CheckViolation → the whole
-- charge (record_usage runs first) fails → swallowed by best-effort billing →
-- NO credits deducted. Symptom: preview shows a cost, balance never moves.
--
-- Same trap the codebase has fixed before (V102, V217, V225). Re-add the
-- constraint with the full set, including a few other RequestType enum values
-- (incident, question_metadata) and direct-deduct buckets (reels_preview,
-- ai_video) that were also never added and would CheckViolation latently.
--
-- Expand-only: every existing row already satisfied the narrower V225 set, so
-- this is a strict superset — validation can't fail on existing data.
-- ================================================================================

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
        'transcription'
    ));

COMMENT ON COLUMN ai_token_usage.request_type IS
    'Type of AI request. Keep in sync with RequestType in ai_service/app/models/ai_token_usage.py — adding a new value REQUIRES expanding this CHECK (see V102/V217/V225/V325).';
