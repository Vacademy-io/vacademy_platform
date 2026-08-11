-- ================================================================================
-- V445 — The Knowledge Base Library
--
-- Turns the PLATFORM owner_type that V435 reserved into an actual catalogue:
-- knowledge bases published from one internal institute, browsable by every
-- client institute, and usable only after a one-time credit unlock.
--
-- Two tables and one pricing row. Nothing here changes an existing table, so
-- this is additive and safe to run against live data.
-- ================================================================================


-- ================================================================================
-- 1. The catalogue entry
--
-- Deliberately SEPARATE from knowledge_base rather than more columns on it.
-- A knowledge base's name is operational ("Physics NCERT XI raw v2"); a listing
-- is merchandising, written for a stranger deciding whether to spend credits.
-- Separating them also means unpublishing touches only this row and never risks
-- the corpus, and a base can be prepared long before it is described.
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_listing (
    id                  VARCHAR(255) PRIMARY KEY,

    -- UNIQUE: one listing per knowledge base. CASCADE because a listing for a
    -- deleted base is meaningless, not something to preserve.
    knowledge_base_id   VARCHAR(255) NOT NULL UNIQUE
                            REFERENCES knowledge_base (id) ON DELETE CASCADE,

    title               VARCHAR(200) NOT NULL,

    -- Capped hard so catalogue cards stay the same height. A summary that can
    -- run to a paragraph produces a ragged grid and buries the shorter ones.
    summary             VARCHAR(280) NOT NULL,
    description         TEXT,

    -- Cover art. file_id points at the existing media service, the same path
    -- PDFs already use, so there is no new upload pipeline. cover_alt is NOT
    -- decoration: without it the catalogue is unusable with a screen reader,
    -- and it is the only text a broken image leaves behind.
    cover_file_id       VARCHAR(255),
    cover_alt           VARCHAR(300),

    -- Typed facets rather than free tags, because these four drive the filter
    -- UI. String-matching a free-text "class 10" against "Class X" is exactly
    -- how a catalogue filter starts returning nothing.
    subject             VARCHAR(100),
    level               VARCHAR(100),
    board               VARCHAR(100),
    language            VARCHAR(50),

    -- Anything beyond the four facets. Searchable, not filterable.
    tags                JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- DRAFT    — being prepared; invisible to clients.
    -- PUBLISHED— in the catalogue.
    -- UNLISTED — hidden from the catalogue but STILL USABLE by institutes that
    --            already unlocked it. Withdrawing a library must never revoke
    --            access somebody paid for.
    status              VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',

    -- Lets us surface the strongest libraries first without renaming them.
    sort_weight         INTEGER      NOT NULL DEFAULT 0,

    published_at        TIMESTAMP,
    published_by        VARCHAR(255),
    created_by          VARCHAR(255),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_listing_status_valid
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNLISTED'))
);

-- The catalogue query: published only, best first, newest as the tiebreak.
CREATE INDEX IF NOT EXISTS idx_kb_listing_published
    ON knowledge_base_listing (sort_weight DESC, published_at DESC)
    WHERE status = 'PUBLISHED';

-- Facet filtering over the published set.
CREATE INDEX IF NOT EXISTS idx_kb_listing_facets
    ON knowledge_base_listing (subject, level, board, language)
    WHERE status = 'PUBLISHED';


-- ================================================================================
-- 2. Who has unlocked what
--
-- One row per institute per library, created when they pay. No expires_at:
-- access is permanent by decision, which keeps every check a plain existence
-- test rather than a time comparison that has to be right in six places.
-- ================================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_entitlement (
    id                  VARCHAR(255) PRIMARY KEY,

    knowledge_base_id   VARCHAR(255) NOT NULL
                            REFERENCES knowledge_base (id) ON DELETE CASCADE,
    institute_id        VARCHAR(255) NOT NULL,

    -- PURCHASE — they paid.
    -- GRANT    — we gave it to them (sales, support, an apology). Recorded
    --            distinctly so a comp is never mistaken for revenue.
    source              VARCHAR(20)  NOT NULL DEFAULT 'PURCHASE',

    -- What they ACTUALLY paid, not what the rate says today. The flat rate will
    -- change; this row is the receipt.
    credits_charged     NUMERIC(12,2) NOT NULL DEFAULT 0,

    granted_by          VARCHAR(255),
    granted_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT kb_entitlement_source_valid
        CHECK (source IN ('PURCHASE', 'GRANT')),

    -- THE important constraint. This is what makes double-charging structurally
    -- impossible rather than merely unlikely — a double-clicked unlock button
    -- races two identical inserts and the database refuses the second.
    CONSTRAINT kb_entitlement_unique
        UNIQUE (knowledge_base_id, institute_id)
);

-- "Which libraries has this institute unlocked?" — asked on every KB list load.
CREATE INDEX IF NOT EXISTS idx_kb_entitlement_institute
    ON knowledge_base_entitlement (institute_id);


-- ================================================================================
-- 3. Pricing
--
-- request_type is 'knowledge_base', already allowed by the V435 CHECK. Reusing
-- an existing value avoids the CHECK-expansion trap that has silently swallowed
-- charges here before.
--
-- MUST stay in sync with DEFAULT_TOOL_PRICING in
-- ai_service/app/services/tool_cost_estimator.py AND computeToolCredits in
-- frontend-admin-dashboard/src/services/ai-credits/get-ai-credits.ts.
-- Three places. Change one, change all three.
--
-- 50 credits is deliberately low. Nothing in the catalogue can be sampled
-- before purchase — no free library, no preview questions — so the first unlock
-- is bought on faith. For comparison a single 60-question paper costs about 95
-- credits, which makes permanent access to a whole library visibly good value
-- and keeps the first purchase from being a real decision. Tune with a plain
-- UPDATE on this row; no deploy is needed.
-- ================================================================================
INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    ('kb_library_unlock', 'knowledge_base', 50, 0, 'flat', '{}'::jsonb)
ON CONFLICT (tool_key) DO NOTHING;
