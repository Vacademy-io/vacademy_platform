-- Migration: Create ai_studio_projects + ai_studio_builds + ai_studio_operation_logs
--            tables for the Vimotion Studio multi-asset video editing pipeline.
-- Description: Studio is the third video pipeline (alongside ai_gen_video and
--              ai_reels). A Project is a persistent edit context — assets +
--              prompt + wizard ConfirmedPlan. A Build is a versioned snapshot
--              built from the project's plan and handed off to the existing
--              video editor (kind=studio). Re-build forks Build N+1 alongside
--              Build N; per-build editor sessions are preserved so the user
--              can switch builds without losing refinements.
-- Date: 2026-05-29
-- Depends on: rename_input_videos_to_input_assets.sql (ai_input_assets must
--             exist — Studio projects reference one or more indexed assets).

BEGIN;

-- Required for gen_random_uuid(). No-op if already enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================
-- ai_studio_projects — one row per persistent edit project
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_studio_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id            TEXT NOT NULL,
    name                    VARCHAR(160),

    -- [{asset_id, handle:"v1", kind:"video"|"image", mode}] — user-tagged refs.
    source_asset_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,

    user_prompt             TEXT,
    target_aspect           VARCHAR(8),
    target_duration_s       INTEGER,

    -- Per-step ConfirmedStepPlan dict keyed by wizard step
    -- ("arrangement" | "cuts" | "overlays" | "audio"). Null until first step
    -- confirmed. Each value carries the user's accept/reject deltas + manual
    -- edits + the LLM-emitted plan it was derived from.
    confirmed_plan          JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Which build the user marked as "the one". FK declared after the builds
    -- table is created (NULLable, ON DELETE SET NULL).
    published_build_id      UUID,

    status                  VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | PLANNING | READY_TO_BUILD | BUILDING | PUBLISHED | ARCHIVED

    -- { tier, model_overrides, ... } — captured at project create time so
    -- downstream LLM calls + executors see consistent config across re-plans.
    config                  JSONB NOT NULL DEFAULT '{}'::jsonb,

    extra_metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message           TEXT,

    created_by_user_id      TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at             TIMESTAMPTZ,

    CONSTRAINT ai_studio_projects_status_check
        CHECK (status IN ('DRAFT', 'PLANNING', 'READY_TO_BUILD',
                          'BUILDING', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_asp_institute            ON ai_studio_projects (institute_id);
CREATE INDEX IF NOT EXISTS idx_asp_status               ON ai_studio_projects (status);
CREATE INDEX IF NOT EXISTS idx_asp_institute_created    ON ai_studio_projects (institute_id, created_at DESC);

COMMENT ON TABLE  ai_studio_projects                  IS 'Vimotion Studio persistent edit projects — assets + prompt + wizard plan; one project can fork many builds.';
COMMENT ON COLUMN ai_studio_projects.source_asset_refs IS '[{asset_id, handle:"v1", kind, mode}] — multi-source manifest; handle is the user-facing reference name in prompts.';
COMMENT ON COLUMN ai_studio_projects.confirmed_plan   IS 'Per-step ConfirmedStepPlan dict (arrangement/cuts/overlays/audio). Mutated as user advances the wizard; snapshot into a build at Build time.';
COMMENT ON COLUMN ai_studio_projects.published_build_id IS 'FK to ai_studio_builds.id — the build the user designated as "publish this one". NULL until first publish.';
COMMENT ON COLUMN ai_studio_projects.status           IS 'DRAFT | PLANNING | READY_TO_BUILD | BUILDING | PUBLISHED | ARCHIVED.';

-- ===========================================================================
-- ai_studio_builds — versioned build snapshot per project
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_studio_builds (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL,
    version                 INTEGER NOT NULL,

    -- Immutable copy of ConfirmedPlan at the moment Build was clicked. The
    -- project's plan can mutate after; this snapshot preserves "what this
    -- build was actually built from" forever.
    plan_snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,

    status                  VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    -- PENDING | BUILDING | AWAITING_EDIT | RENDERED | FAILED
    build_stage             VARCHAR(64) NOT NULL DEFAULT 'PENDING',
    progress                INTEGER NOT NULL DEFAULT 0,

    -- Per-stage progress array (mirrors ai_reels.stages): [{stage, progress}].
    stages                  JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Output artifact URLs: timeline, audio, words, video, thumbnail.
    s3_urls                 JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- { aspect, fps, render_config_hash, ... } — controls re-render + dedup.
    config                  JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- { live snapshot, cost digest, build-stage timings, etc. }
    extra_metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

    error_message           TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    archived_at             TIMESTAMPTZ,

    CONSTRAINT ai_studio_builds_status_check
        CHECK (status IN ('PENDING', 'BUILDING', 'AWAITING_EDIT',
                          'RENDERED', 'FAILED')),
    CONSTRAINT ai_studio_builds_progress_range
        CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT ai_studio_builds_version_pos
        CHECK (version >= 1)
);

-- Monotonic v1, v2, ... per project. Application is responsible for picking
-- next-version on insert; the unique constraint catches races.
CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_build_version
    ON ai_studio_builds (project_id, version);

CREATE INDEX IF NOT EXISTS idx_asb_project_status
    ON ai_studio_builds (project_id, status);
CREATE INDEX IF NOT EXISTS idx_asb_project_created
    ON ai_studio_builds (project_id, created_at DESC);

-- In-flight idempotency: prevents double-clicks creating Build N+1 AND N+2
-- from the same plan snapshot. Once a build flips to AWAITING_EDIT / RENDERED
-- / FAILED the slot reopens so the user CAN intentionally fork a new build
-- from the same plan again.
CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_active_build
    ON ai_studio_builds (project_id, (config->>'render_config_hash'))
    WHERE status IN ('PENDING', 'BUILDING');

COMMENT ON TABLE  ai_studio_builds                IS 'Versioned build snapshots per Studio project. Each build owns its own editor session via /frame/* endpoints.';
COMMENT ON COLUMN ai_studio_builds.project_id     IS 'FK to ai_studio_projects.id. ON DELETE CASCADE — deleting a project deletes all its builds.';
COMMENT ON COLUMN ai_studio_builds.version        IS 'Monotonic per project (v1, v2, ...). User picks which to "publish".';
COMMENT ON COLUMN ai_studio_builds.plan_snapshot  IS 'Immutable copy of ConfirmedPlan at Build time. Survives later edits to the project plan — preserves "what this build was built from".';
COMMENT ON COLUMN ai_studio_builds.status         IS 'PENDING (queued) → BUILDING (executor running) → AWAITING_EDIT (handed off to editor) | RENDERED (final MP4 in S3) | FAILED.';
COMMENT ON COLUMN ai_studio_builds.build_stage    IS 'ASSEMBLE_AUDIO | ASSEMBLE_WORDS | ASSEMBLE_TIMELINE | COMPOSE_HTML | UPLOAD | HANDOFF | RENDERED | FAILED.';
COMMENT ON COLUMN ai_studio_builds.s3_urls        IS 'Output artifact URLs: timeline, audio, words, video (post-render), thumbnail.';

-- ===========================================================================
-- Cross-table FKs
-- ===========================================================================

-- Builds belong to projects. Deleting a project cascades its builds; the
-- editor's frame endpoints will return 404 once the build row is gone.
ALTER TABLE ai_studio_builds
    DROP CONSTRAINT IF EXISTS ai_studio_builds_project_fk;
ALTER TABLE ai_studio_builds
    ADD CONSTRAINT ai_studio_builds_project_fk
    FOREIGN KEY (project_id)
    REFERENCES ai_studio_projects(id)
    ON DELETE CASCADE;

-- A project may point at a build as its "published" one. SET NULL on build
-- delete so the project survives an accidental build deletion.
ALTER TABLE ai_studio_projects
    DROP CONSTRAINT IF EXISTS ai_studio_projects_published_build_fk;
ALTER TABLE ai_studio_projects
    ADD CONSTRAINT ai_studio_projects_published_build_fk
    FOREIGN KEY (published_build_id)
    REFERENCES ai_studio_builds(id)
    ON DELETE SET NULL;

-- ===========================================================================
-- ai_studio_operation_logs — per-tool audit for "why did the LLM choose this?"
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_studio_operation_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id                UUID NOT NULL,
    step                    VARCHAR(32) NOT NULL,
    -- arrangement | cuts | overlays | audio
    operation_index         INTEGER NOT NULL,
    tool                    VARCHAR(64) NOT NULL,
    params                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_action             VARCHAR(16) NOT NULL DEFAULT 'auto',
    -- accepted | rejected | edited | auto
    applied                 BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_studio_op_logs_step_check
        CHECK (step IN ('arrangement', 'cuts', 'overlays', 'audio')),
    CONSTRAINT ai_studio_op_logs_action_check
        CHECK (user_action IN ('accepted', 'rejected', 'edited', 'auto'))
);

ALTER TABLE ai_studio_operation_logs
    DROP CONSTRAINT IF EXISTS ai_studio_op_logs_build_fk;
ALTER TABLE ai_studio_operation_logs
    ADD CONSTRAINT ai_studio_op_logs_build_fk
    FOREIGN KEY (build_id)
    REFERENCES ai_studio_builds(id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_asol_build_step
    ON ai_studio_operation_logs (build_id, step, operation_index);

COMMENT ON TABLE ai_studio_operation_logs IS 'Per-operation audit log for Studio builds — which tool was proposed by the LLM, what the user did with it, whether it ended up applied.';

COMMIT;
