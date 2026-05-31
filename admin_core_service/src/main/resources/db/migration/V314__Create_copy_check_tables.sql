-- Copy-check rubric tables for the AI handwritten-answer-sheet grading
-- pipeline. Owned by ai-service (Python) but managed via admin-core-service
-- Flyway because ai-service has no migration tool of its own — same pattern
-- as ai_api_keys (V70), chat_agent_tables (V78), and the ai_studio_tables (V312).
--
-- copy_check_rubric: assessment-level fixed rubric. When present, takes
-- priority over LLM-derived criteria generation in CopyCheckOrchestratorService.
-- One row per (institute, assessment). rubric_json is a JSON map
-- {question_id: CriteriaRubricDto}.
--
-- copy_check_question_answer: per-question overrides. Lets authors edit a
-- single question's model answer + step rubric without rewriting the whole
-- rubric_json blob above.

CREATE TABLE IF NOT EXISTS copy_check_rubric (
    assessment_id        VARCHAR(64) PRIMARY KEY,
    institute_id         VARCHAR(64) NOT NULL,
    rubric_version       INTEGER NOT NULL DEFAULT 1,
    rubric_json          TEXT NOT NULL,
    model_answers_json   TEXT NULL,
    created_by           VARCHAR(64) NULL,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copy_check_rubric_institute
    ON copy_check_rubric(institute_id);


CREATE TABLE IF NOT EXISTS copy_check_question_answer (
    id                   VARCHAR(64) PRIMARY KEY,
    assessment_id        VARCHAR(64) NOT NULL,
    question_id          VARCHAR(64) NOT NULL,
    model_answer         TEXT NULL,
    step_rubric_json     TEXT NULL,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copy_check_qa_assessment
    ON copy_check_question_answer(assessment_id);

-- Each question can have at most one override per assessment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_copy_check_qa_assessment_question
    ON copy_check_question_answer(assessment_id, question_id);


-- updated_at triggers (match the convention from V70__Create_ai_api_keys_table)

CREATE OR REPLACE FUNCTION update_copy_check_rubric_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_copy_check_rubric_updated_at ON copy_check_rubric;
CREATE TRIGGER trigger_update_copy_check_rubric_updated_at
    BEFORE UPDATE ON copy_check_rubric
    FOR EACH ROW
    EXECUTE FUNCTION update_copy_check_rubric_updated_at();


CREATE OR REPLACE FUNCTION update_copy_check_question_answer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_copy_check_qa_updated_at ON copy_check_question_answer;
CREATE TRIGGER trigger_update_copy_check_qa_updated_at
    BEFORE UPDATE ON copy_check_question_answer
    FOR EACH ROW
    EXECUTE FUNCTION update_copy_check_question_answer_updated_at();


COMMENT ON TABLE copy_check_rubric IS
    'Assessment-level fixed rubric for the AI copy-check pipeline. Takes priority over LLM-derived criteria when present.';
COMMENT ON COLUMN copy_check_rubric.rubric_json IS
    'JSON map keyed by question_id; each value is a CriteriaRubricDto blob.';
COMMENT ON COLUMN copy_check_rubric.model_answers_json IS
    'JSON map keyed by question_id; each value is the model answer text (used to seed criteria generation).';
COMMENT ON COLUMN copy_check_rubric.rubric_version IS
    'Monotonic version bumped on every upsert. Used by the FE to show "rubric changed since this evaluation" badges.';

COMMENT ON TABLE copy_check_question_answer IS
    'Per-question override that wins over copy_check_rubric.rubric_json[question_id] when present.';
