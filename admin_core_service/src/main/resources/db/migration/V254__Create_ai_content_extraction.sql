-- AI content pipeline — intermediate processed forms (transcripts, OCR text, …).
--
-- One row per (source, extraction_type). A single source can be processed by
-- multiple extractors (e.g. Whisper transcript + slide OCR for the same
-- recording), but only one row per type per source — re-running overwrites.
--
-- v1 only writes extraction_type='WHISPER_TRANSCRIBE_TRANSLATE' rows. The
-- output files (json/srt/vtt/txt × source/english) live on S3; this table
-- holds the URLs plus the language metadata we want indexed.
--
-- job_id is the render-worker job identifier — used as the idempotency key
-- when the worker calls back with terminal state.

CREATE TABLE IF NOT EXISTS ai_content_extraction (
    id                    VARCHAR(36)  PRIMARY KEY,
    source_id             VARCHAR(36)  NOT NULL REFERENCES ai_content_source(id),
    extraction_type       VARCHAR(64)  NOT NULL,             -- v1: 'WHISPER_TRANSCRIBE_TRANSLATE'
    status                VARCHAR(32)  NOT NULL,             -- QUEUED | RUNNING | COMPLETED | FAILED
    job_id                VARCHAR(255),                      -- render-worker job id (idempotency key)

    -- Language metadata. Both come from faster-whisper's info.language /
    -- info.language_probability. Always populated on COMPLETED rows; null
    -- on QUEUED/RUNNING/FAILED.
    detected_language     VARCHAR(16),                       -- ISO code: 'hi', 'en', 'ta', ...
    language_probability  DOUBLE PRECISION,                  -- 0..1 confidence

    -- Raw metrics from the extraction job.
    duration_seconds      DOUBLE PRECISION,
    segment_count         INTEGER,
    word_count            INTEGER,

    -- The two transcripts we always want. Plain-text variants live here for
    -- direct LLM grounding (english_text_url is what Gemini reads when we
    -- generate an assessment).
    source_text_url       TEXT,                              -- S3: detected-language .txt
    english_text_url      TEXT,                              -- S3: English .txt

    -- Richer format variants (srt/vtt/json × source/english). Stored as a
    -- JSON blob since not every extraction type produces all six.
    format_urls_json      TEXT,                              -- JSON: { source_srt, source_vtt, source_json, english_srt, english_vtt, english_json }

    metadata_json         TEXT,                              -- JSON: worker version, model, params
    error_message         TEXT,                              -- non-null when status='FAILED'

    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_ai_content_extraction UNIQUE (source_id, extraction_type)
);

-- Callback handler keys on job_id (worker idempotency).
CREATE INDEX IF NOT EXISTS idx_ai_content_extraction_job
    ON ai_content_extraction (job_id);

-- UI status lookups + worker-housekeeping queries filter by status.
CREATE INDEX IF NOT EXISTS idx_ai_content_extraction_status
    ON ai_content_extraction (status);

-- Foreign-key joins from source rows.
CREATE INDEX IF NOT EXISTS idx_ai_content_extraction_source
    ON ai_content_extraction (source_id);
