-- AI content pipeline — manifest of "things we can generate from".
--
-- One row per generation source (a BBB recording, a PDF, a YouTube URL, …).
-- v1 only writes source_type='BBB_RECORDING' rows; the table is intentionally
-- polymorphic so future source types plug in without a schema change.
--
-- source_id references the id of the source in its owning system (e.g. the
-- BBB recordingId stored in MeetingRecordingDTO). The (source_type, source_id)
-- pair is globally unique — one canonical row per source artifact.

CREATE TABLE IF NOT EXISTS ai_content_source (
    id              VARCHAR(36)  PRIMARY KEY,
    source_type     VARCHAR(64)  NOT NULL,                   -- v1: 'BBB_RECORDING'
    source_id       VARCHAR(255) NOT NULL,                   -- id in owning system
    source_url      TEXT,                                    -- canonical S3 / external URL
    institute_id    VARCHAR(255) NOT NULL,
    created_by      VARCHAR(255),                            -- user id who triggered generation
    metadata_json   TEXT,                                    -- JSON: type-specific extras
                                                             -- (session_schedule_id, file_id, duration_seconds, ...)
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_ai_content_source UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_content_source_institute
    ON ai_content_source (institute_id);

CREATE INDEX IF NOT EXISTS idx_ai_content_source_type
    ON ai_content_source (source_type);
