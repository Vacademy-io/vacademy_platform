-- Layer 3 — final outputs generated FROM an ai_content_source (e.g. an
-- assessment generated from a recording transcript). The polymorphic shape
-- mirrors ai_content_source / ai_content_extraction:
--
--   ai_content_source        — "what was the input?"          (e.g. a BBB recording)
--   ai_content_extraction    — "what intermediate text did we derive?" (e.g. Whisper transcript)
--   ai_generated_artifact    — "what final artifact did we generate?"  (e.g. assessment, flashcards, notes)
--
-- v1 only writes artifact_type='ASSESSMENT' rows. The generated content
-- (title + questions in JSON) is stored verbatim so:
--   (a) the UI can preview before persisting to assessment_service
--   (b) regeneration is cheap (no re-LLM-call needed)
--   (c) provenance back to the source recording is preserved via FKs
--
-- artifact_id is a soft pointer to whatever target system holds the persisted
-- artifact (e.g. assessment.id in assessment_service). NULL while content is
-- generated but not yet pushed to the target service.

CREATE TABLE IF NOT EXISTS ai_generated_artifact (
    id                          VARCHAR(36)  PRIMARY KEY,

    -- Provenance
    source_id                   VARCHAR(36)  NOT NULL REFERENCES ai_content_source(id),
    extraction_id               VARCHAR(36)  REFERENCES ai_content_extraction(id),  -- nullable: text sources can skip extraction

    -- What was generated
    artifact_type               VARCHAR(64)  NOT NULL,                              -- v1: 'ASSESSMENT'

    -- Soft pointer into target system (e.g. assessment_service.assessment.id)
    artifact_id                 VARCHAR(255),
    artifact_url                TEXT,                                               -- direct-view URL for the UI

    -- State machine
    status                      VARCHAR(32)  NOT NULL,                              -- IN_PROGRESS | COMPLETED | FAILED
    error_message               TEXT,

    -- The LLM-generated content itself. For ASSESSMENT type, shape is:
    --   { "title": "...", "questions": [ {id, question, options[], correct_answer_index, explanation}, ... ] }
    -- Stored as TEXT (parsed via ObjectMapper in service code) to match the
    -- provider_recordings_json pattern elsewhere in this service.
    generated_content_json      TEXT,

    -- The user-supplied params that drove generation (start/end dates, marks,
    -- visibility, num_questions, etc. — varies by artifact_type).
    generation_params_json      TEXT,

    -- Which LLM produced the content. Helps with debugging quality regressions
    -- and lets us re-run with a stronger model later.
    model_used                  VARCHAR(128),

    -- Audit
    created_by                  VARCHAR(255),
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_artifact_source
    ON ai_generated_artifact (source_id);

CREATE INDEX IF NOT EXISTS idx_ai_generated_artifact_extraction
    ON ai_generated_artifact (extraction_id);

-- Reverse lookup: "which source/extraction produced this assessment?"
CREATE INDEX IF NOT EXISTS idx_ai_generated_artifact_type_id
    ON ai_generated_artifact (artifact_type, artifact_id);
