-- Cache the raw English transcript text on the extraction row so the
-- create-assessment flow no longer needs to hit S3 for every LLM call.
-- Filled in by the Whisper callback when the job reaches COMPLETED.
-- Nullable to remain backwards-compatible with rows transcribed before
-- this migration (those still resolve via english_text_url).
ALTER TABLE ai_content_extraction
    ADD COLUMN IF NOT EXISTS english_text_content TEXT;
