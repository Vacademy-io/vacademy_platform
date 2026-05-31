-- Cache LLM-generated study notes alongside the transcript that produced them.
-- This is per-extraction (one notes blob per recording's transcription row),
-- not per-user, because a recording's lecture content is the same for every
-- student — caching at the org/extraction level is what we want.
--
-- The notes column is unbounded TEXT because typical lecture-notes markdown
-- runs 3–10 KB but can grow longer for 2-hour recordings with multiple
-- comparison tables.
--
-- Nullable on purpose: the column has no value until the first time a user
-- clicks "Generate Lecture Notes" on this recording.

ALTER TABLE ai_content_extraction
    ADD COLUMN study_notes_markdown TEXT,
    ADD COLUMN study_notes_generated_at TIMESTAMP;
