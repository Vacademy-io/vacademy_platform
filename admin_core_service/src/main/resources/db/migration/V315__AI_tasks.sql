-- Migration: Add ai_task table + seed the 'lecture' use-case default
-- Description: Durable async-task tracker owned by ai_service, mirroring the
--   shape of media_service.task_status. Backs the migrated AI endpoints
--   (lecture planner first). Also seeds an ai_model_defaults row for the
--   'lecture' use case so model selection is DB-driven (no hardcoded model id,
--   which is what caused the gemini-2.5-flash-preview-09-2025 404 in Java).
-- Date: 2026-05-30
-- Idempotent: Yes (IF NOT EXISTS + ON CONFLICT DO NOTHING).
--   This DDL is also applied at app startup by ensure_ai_task_schema() so the
--   feature works without a separate manual migration step.

CREATE TABLE IF NOT EXISTS ai_task (
    id                 VARCHAR(255) PRIMARY KEY,
    "type"             VARCHAR(255),
    status             VARCHAR(255),
    institute_id       VARCHAR(255),
    result_json        TEXT,
    input_id           VARCHAR(255),
    input_type         VARCHAR(255),
    task_name          VARCHAR(255),
    parent_id          VARCHAR(255),
    status_message     TEXT,
    dynamic_values_map TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_task_institute_id ON ai_task(institute_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_type         ON ai_task("type");
CREATE INDEX IF NOT EXISTS idx_ai_task_status       ON ai_task(status);
CREATE INDEX IF NOT EXISTS idx_ai_task_parent_id    ON ai_task(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_created_at   ON ai_task(created_at);

-- Seed the 'lecture' use-case default. Uses currently-valid OpenRouter ids.
-- ROOT_ADMIN can retune these later via PATCH /ai-service/models/v2/defaults/lecture.
INSERT INTO ai_model_defaults (use_case, default_model_id, fallback_model_id, free_tier_model_id, description)
VALUES (
    'lecture',
    'google/gemini-2.5-flash',
    'openai/gpt-4o-mini',
    NULL,
    'Lecture planning and feedback generation (migrated from media_service).'
)
ON CONFLICT (use_case) DO NOTHING;