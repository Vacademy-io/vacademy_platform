-- Counsellor rating per (institute, counsellor). Replaces the
-- institute.setting_json -> setting -> LEAD_SETTING -> data -> workbench ->
-- counsellor_ratings JSON map. Strategy CONFIG (window, weights, success
-- statuses) stays in the JSON blob — only the per-counsellor SCORES move.
--
-- Why a table:
--   * Atomic per-row upsert. The nightly recompute now writes one row per
--     counsellor instead of read-mutate-write the whole institute blob,
--     which made concurrent recomputes / admin manual_override edits a
--     last-write-wins race.
--   * Index supports the leaderboard's `ORDER BY score DESC LIMIT N` query
--     directly — previously every read deserialized the whole JSON map.
--   * Per-row updated_at + last_computed_at enable "find stale ratings"
--     without parsing JSON.
--
-- No backfill: at the time of this migration there is no production data
-- under workbench.counsellor_ratings. Ratings will start populating as
-- nightly recomputes run + admins set manual overrides post-deploy.
CREATE TABLE IF NOT EXISTS counsellor_rating (
    id                       VARCHAR(36)  PRIMARY KEY,
    institute_id             VARCHAR(36)  NOT NULL,
    counsellor_user_id       VARCHAR(36)  NOT NULL,
    -- 'STATIC' | 'STRATEGY_BASED'. Snapshot of the strategy that produced
    -- the score, so a later strategy flip can be diagnosed without
    -- re-running the compute job.
    strategy_type            VARCHAR(32)  NOT NULL,
    -- The effective 0..100 score callers should read.
    score                    NUMERIC(6, 2),
    -- Components, populated only for STRATEGY_BASED snapshots; null for STATIC.
    conversion_ratio_score   NUMERIC(6, 2),
    velocity_score           NUMERIC(6, 2),
    -- Assigned leads observed in the window. NULL for STATIC.
    sample_size              INTEGER,
    -- Remembered admin-set value. Survives strategy toggles — the compute
    -- service seeds the new snapshot from this on every recompute.
    manual_override          NUMERIC(6, 2),
    last_computed_at         TIMESTAMPTZ,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_counsellor_rating_institute_user
        UNIQUE (institute_id, counsellor_user_id)
);

-- Powers the leaderboard's "top N by score" query without a table scan.
-- Nulls sink to the bottom so unrated counsellors don't squat at the top.
-- Also supports the future workbench list filter "active counsellors with
-- score > X" — when the rating becomes a filter column the index is hit
-- whether the query is "leaderboard" or "filter by score range".
CREATE INDEX IF NOT EXISTS ix_counsellor_rating_leaderboard
    ON counsellor_rating (institute_id, score DESC NULLS LAST);

-- Used by the "find stale ratings" scan if we ever add an incremental
-- recompute (today's scheduler does an unconditional full sweep at 02:00 IST).
CREATE INDEX IF NOT EXISTS ix_counsellor_rating_recompute
    ON counsellor_rating (institute_id, last_computed_at);
