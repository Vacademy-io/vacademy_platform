-- ================================================================================
-- V258: Per-stage AI model assignments for the AI video pipeline
-- ================================================================================
--
-- Background:
-- The AI video pipeline has ~17 distinct LLM call sites. Today every call uses
-- one of two clients (script_client / html_client), both initialized with the
-- same model (`google/gemini-3-flash-preview`) across all 5 quality tiers. The
-- user override on the request body replaces that single model globally — so
-- a user picking Pro pays Pro tokens for tiny utility prompts, and a user
-- picking a cheap model degrades critical stages.
--
-- This migration introduces a per-(use_case, quality_tier, stage) assignment
-- matrix. The AI video service reads this matrix at pipeline init time and
-- routes each LLM call to the appropriate model. Vision review and small
-- utility prompts are marked `user_overridable=false` so they stay on admin
-- defaults regardless of what the user picks.
--
-- 17 stages × 5 tiers = 85 rows seeded below. The seed matches the effective
-- behavior today (Flash for the CRITICAL bulk, Pro pinned to vision review,
-- Flash variants for utility), so flipping the new resolver on is a no-op on
-- day 1. Admins can edit individual cells via SQL post-launch to optimize
-- (e.g., flip ultra-tier per_shot_html to Pro for an A/B test).
--
-- See: app/constants/pipeline_stages.py (Python enum), docs/ai_content/
-- AI_VIDEO_ARCHITECTURE_CHANGES.md (pipeline overview).
-- ================================================================================

CREATE TABLE IF NOT EXISTS ai_model_stage_assignments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case          VARCHAR(50)  NOT NULL,           -- 'video' for now
    quality_tier      VARCHAR(32)  NOT NULL,           -- free/standard/premium/ultra/super_ultra
    stage_id          VARCHAR(64)  NOT NULL,           -- one of PipelineStage enum values
    model_id          VARCHAR(100) NOT NULL,           -- references ai_models.model_id (logical FK)
    fallback_model_id VARCHAR(100),                    -- used by OpenRouterClient on primary failure
    user_overridable  BOOLEAN NOT NULL DEFAULT FALSE,  -- if true, user's model_overrides can replace
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stage_assignment UNIQUE (use_case, quality_tier, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_assignments_lookup
    ON ai_model_stage_assignments (use_case, quality_tier, stage_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_stage_assignments_active
    ON ai_model_stage_assignments (is_active);

-- ================================================================================
-- Seed: 17 stages × 5 tiers = 85 rows
-- ================================================================================
--
-- Generated as a CROSS JOIN of the stage taxonomy with the 5 quality tiers so
-- the same default applies to every tier on day 1. Admins can UPDATE individual
-- (tier, stage_id) cells later to differentiate (e.g., bump ultra's
-- per_shot_html to Pro).
--
-- Buckets:
--   CRITICAL: shot_planner, narration_writer, per_shot_html, vision_review,
--             director (v2), script_generation (v2), script_review (v2)
--   MEDIUM:   act_planner, beat_planner (v2), image_prompt_enhancement,
--             stock_video_ranking, entity_extraction
--   UTILITY:  regen_html, cultural_context, shot_decomposer, host_description,
--             headline_thumbnail
--
-- user_overridable=TRUE on: shot_planner, narration_writer, per_shot_html,
--   director, script_generation, script_review, act_planner, regen_html (8 stages).
-- Everything else (9 stages including vision_review) is pinned.

INSERT INTO ai_model_stage_assignments
    (use_case, quality_tier, stage_id, model_id, fallback_model_id, user_overridable, notes)
SELECT 'video', t.quality_tier, s.stage_id, s.model_id, s.fallback_model_id,
       s.user_overridable, s.notes
FROM (
    VALUES
    -- ── CRITICAL ─────────────────────────────────────────────────────────
    ('shot_planner',         'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL: plans the entire video shot-by-shot. v3 pipeline''s primary LLM call.'),
    ('narration_writer',     'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL: authors per-shot narration with one coherent voice. v3 pipeline.'),
    ('per_shot_html',        'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL: generates HTML for each shot. N calls per video — biggest token bucket.'),
    ('vision_review',        'google/gemini-2.5-pro',         'google/gemini-2.5-flash', FALSE,
     'CRITICAL+pinned: vision rubric review of rendered shots. Pinned to Pro for quality gate; not user-overridable.'),
    ('director',             'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL (v2 legacy): full shot plan JSON. Overridable until v2 deletion.'),
    ('script_generation',    'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL (v2 legacy): monolithic script + beat outline. Overridable until v2 deletion.'),
    ('script_review',        'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'CRITICAL (v2 legacy): two-pass script review/edit. Overridable until v2 deletion.'),

    -- ── MEDIUM ───────────────────────────────────────────────────────────
    ('act_planner',          'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'MEDIUM: decomposes multi-segment intent into acts before ShotPlanner.'),
    ('beat_planner',         'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', FALSE,
     'MEDIUM (v2 legacy): temporal pacing outline with intent roles.'),
    ('image_prompt_enhancement', 'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', FALSE,
     'MEDIUM: adds cinematic detail to image-generation prompts (N per video).'),
    ('stock_video_ranking',  'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', FALSE,
     'MEDIUM: scores Pexels/Pixabay candidates against narration + visual intent.'),
    ('entity_extraction',    'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', FALSE,
     'MEDIUM: pulls proper nouns from the script for reference asset search.'),

    -- ── UTILITY ──────────────────────────────────────────────────────────
    ('regen_html',           'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', TRUE,
     'UTILITY: corrective regen for html_repair / brand_asset / bbox / vision_corrective / animation_validator. Single bucket — 5 physical call sites.'),
    ('cultural_context',     'google/gemini-2.5-flash',       'google/gemini-2.5-flash', FALSE,
     'UTILITY: region/cultural-context inference for stock image biasing.'),
    ('shot_decomposer',      'google/gemini-3-flash-preview', 'google/gemini-2.5-flash', FALSE,
     'UTILITY: splits overlong shots into two when narration overruns shot duration.'),
    ('host_description',     'google/gemini-2.5-flash',       'google/gemini-2.5-flash', FALSE,
     'UTILITY: generates set-description text for avatar-host runs.'),
    ('headline_thumbnail',   'google/gemini-2.5-flash',       'google/gemini-2.5-flash', FALSE,
     'UTILITY: drafts clickable headline copy for the run thumbnail.')
) AS s(stage_id, model_id, fallback_model_id, user_overridable, notes)
CROSS JOIN (
    VALUES ('free'), ('standard'), ('premium'), ('ultra'), ('super_ultra')
) AS t(quality_tier)
ON CONFLICT (use_case, quality_tier, stage_id) DO UPDATE SET
    model_id          = EXCLUDED.model_id,
    fallback_model_id = EXCLUDED.fallback_model_id,
    user_overridable  = EXCLUDED.user_overridable,
    notes             = EXCLUDED.notes,
    updated_at        = now();

-- ================================================================================
-- Verification (run after migration)
-- ================================================================================
-- SELECT quality_tier, stage_id, model_id, user_overridable
-- FROM ai_model_stage_assignments
-- WHERE use_case = 'video' AND is_active = TRUE
-- ORDER BY quality_tier, stage_id;
--
-- Expect: 85 rows. 40 with user_overridable=TRUE (8 stages × 5 tiers).
-- 45 with user_overridable=FALSE (9 stages × 5 tiers).
-- All vision_review rows should have model_id = 'google/gemini-2.5-pro'.
