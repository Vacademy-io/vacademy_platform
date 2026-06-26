-- =============================================================================
-- V345: Call Intelligence — per-call transcription + LLM analysis.
--
-- The CRM already records EVERY call (manual upload, telephony — Exotel/Airtel,
-- and AI — Aavtaar) as one row in telephony_call_log. This table is the
-- provider-agnostic intelligence layer on top of it: one row per analyzed call
-- (1:1 with telephony_call_log), holding the transcript references and the
-- structured data points the LLM extracts (summary, action items, a generic
-- outcome status, the two 0-10 ratings, sentiment, …).
--
-- The row ALSO IS the work item / queue entry: a scheduled poller drains
-- status='PENDING' rows, transcribes (render worker, Hindi+English), analyzes
-- (LLM, OpenRouter) and writes the results back. We use a DB-backed queue, not
-- the in-JVM event bus, because that bus silently drops events across the prod
-- replicas. Gated per institute by CRM_INTELLIGENCE_SETTING.
--
-- A few hot dashboard dimensions (institute, counsellor, source, direction,
-- started_at, duration) are denormalized from telephony_call_log so the
-- per-counsellor / per-team / per-lead roll-ups never have to join the (large)
-- call-log table. The full nested analysis (action items, objections, rubric
-- quality breakdown, highlights) stays in analysis_json; only the scalars used
-- for filtering/aggregation get first-class columns. schema_version lets the
-- prompt contract evolve without breaking old rows.
-- =============================================================================

CREATE TABLE call_intelligence (
    id                       VARCHAR(36)  PRIMARY KEY,
    -- 1:1 with the universal call record. Unique (one analysis per call).
    call_log_id              VARCHAR(36)  NOT NULL,
    institute_id             VARCHAR(36)  NOT NULL,

    -- Denormalized from telephony_call_log for dashboard roll-ups (avoid join).
    counsellor_user_id       VARCHAR(36),
    response_id              VARCHAR(36),
    user_id                  VARCHAR(36),
    source                   VARCHAR(16),          -- MANUAL | TELEPHONY | AI (bucketed from provider_type)
    direction                VARCHAR(16),          -- OUTBOUND | INBOUND
    call_started_at          TIMESTAMP,            -- the "time the call happened" data point
    duration_seconds         INTEGER,

    -- Pipeline / queue state. PENDING is the poller's work signal.
    status                   VARCHAR(24)  NOT NULL DEFAULT 'PENDING',
                             -- PENDING → TRANSCRIBING → ANALYZING → COMPLETED
                             --        ↘ FAILED (retryable) / SKIPPED (terminal, no charge)
    skip_reason              VARCHAR(48),          -- INSUFFICIENT_CREDITS | DISABLED | NO_RECORDING | TOO_SHORT | NOT_CONNECTED | SOURCE_DISABLED
    job_id                   VARCHAR(64),          -- ai_service / render-worker job id
    attempts                 INTEGER      NOT NULL DEFAULT 0,
    error                    TEXT,

    -- Transcript artifacts (S3 keys produced by the render worker, task='both').
    source_text_key          VARCHAR(512),         -- transcript in the spoken language (hi/en/mixed)
    english_text_key         VARCHAR(512),         -- English translation pass
    detected_language        VARCHAR(16),
    language_probability     NUMERIC(4,3),

    -- First-class extracted data points (filtered/aggregated on dashboards).
    inferred_goal            TEXT,                 -- AI-inferred objective of the call
    call_type                VARCHAR(32),          -- SALES_OUTREACH | FOLLOW_UP | DEMO_BOOKING | ...
    general_summary          TEXT,
    generic_status           VARCHAR(32),          -- CONNECTED_POSITIVE | NOT_INTERESTED | CALLBACK_REQUESTED | ...
    caller_self_goal_rating  NUMERIC(4,2),         -- 0-10: how well the caller advanced their objective
    call_output_rating       NUMERIC(4,2),         -- 0-10: outcome strength from the lead's perspective
    conversion_likelihood    VARCHAR(8),           -- HIGH | MEDIUM | LOW
    lead_sentiment           VARCHAR(12),          -- POSITIVE | NEUTRAL | NEGATIVE

    -- Full structured analysis (action_items, call_analysis, rating qualities,
    -- coaching_tips, talk_ratio, highlights, …) — see the LLM output contract.
    analysis_json            JSONB,
    schema_version           VARCHAR(8),

    -- Credit accounting (flat per-call charge, see credit_pricing 'call_intelligence').
    credits_charged          NUMERIC(8,2),
    usage_log_id             VARCHAR(36),          -- links to ai_token_usage.id

    -- Model audit.
    model                    VARCHAR(100),
    prompt_version           VARCHAR(16),

    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at             TIMESTAMP
);

-- One analysis per call (idempotent enqueue / re-run reuses the same row).
CREATE UNIQUE INDEX uk_call_intelligence_call_log ON call_intelligence(call_log_id);

-- The poller drains PENDING oldest-first. Partial → tiny, only live work.
CREATE INDEX idx_ci_queue ON call_intelligence(status, created_at)
    WHERE status = 'PENDING';

-- Dashboard roll-ups: per-institute, per-counsellor, per-lead, per-user.
CREATE INDEX idx_ci_institute  ON call_intelligence(institute_id, call_started_at DESC);
CREATE INDEX idx_ci_counsellor ON call_intelligence(counsellor_user_id, call_started_at DESC);
CREATE INDEX idx_ci_response   ON call_intelligence(response_id);
CREATE INDEX idx_ci_user       ON call_intelligence(user_id);

-- -----------------------------------------------------------------------------
-- Credit pricing: flat 5 credits per analyzed call. DB-managed (this row), so
-- the price changes with a single UPDATE — no deploy. base_cost only,
-- token_rate=0, unit_type='none' → exactly 5 credits regardless of call length
-- or LLM tokens. An institute can override this globally-set price via
-- CRM_INTELLIGENCE_SETTING.calls.creditCostOverride (null = use this row).
-- -----------------------------------------------------------------------------
INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description)
VALUES ('call_intelligence', 5.0, 0, 5.0, 'none', 'Call recording transcription + analysis (flat per call)')
ON CONFLICT (request_type) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Expand the ai_token_usage.request_type CHECK to allow 'call_intelligence'.
-- This is the same trap fixed in V102/V217/V225/V325: the billing path writes an
-- ai_token_usage row FIRST, so a value missing from this CHECK throws a
-- CheckViolation → the whole charge is swallowed by best-effort billing → NO
-- credits deducted (balance never moves). Expand-only: strict superset of V325.
-- Keep in sync with RequestType in ai_service/app/models/ai_token_usage.py.
-- -----------------------------------------------------------------------------
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
        'incident',
        'question_metadata',
        'stock',
        'avatar_video',
        'reels_preview',
        'ai_video',
        'assessment',
        'notes',
        'transcription',
        'call_intelligence'
    ));
