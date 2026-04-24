-- Add missing request_type values to ai_token_usage check constraint.
-- The Python enum (ai_service) already defines these; the DB constraint was lagging behind,
-- causing CheckViolation errors when logging stock image/video usage.

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
        'stock'
    ));

COMMENT ON COLUMN ai_token_usage.request_type IS 'Type of AI request: outline, image, content, video, tts, tts_premium, embedding, evaluation, presentation, conversation, lecture, course_content, pdf_questions, agent, analytics, copilot, stock';
