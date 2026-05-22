-- ============================================================
-- V302: Counselor Pool & Auto-Assignment
--
-- Introduces the pool-based counselor assignment model for the
-- new lead pipeline. A pool groups counselors and links to one
-- or more campaigns (audiences). When a lead enters a campaign,
-- the pool decides how a counselor is picked: MANUAL, ROUND_ROBIN,
-- or TIME_BASED (via shift schedule).
--
-- 5 new tables. No changes to existing tables.
-- Assignment result is written to user_lead_profile.assigned_counselor_id
-- (existing column).
-- ============================================================

-- 1. Counselor Pool
CREATE TABLE IF NOT EXISTS counselor_pool (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id    TEXT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    assignment_mode VARCHAR(50) NOT NULL,        -- 'MANUAL' | 'ROUND_ROBIN' | 'TIME_BASED'
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_institute ON counselor_pool(institute_id);


-- 2. Pool <-> Audience link.
-- A pool can hold many audiences, but each audience belongs to
-- exactly one pool at a time (enforced by UNIQUE on audience_id).
-- Per-audience round-robin pointer lives on this row so each
-- campaign cycles through its counselors independently.
CREATE TABLE IF NOT EXISTS counselor_pool_audience (
    id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pool_id                     TEXT NOT NULL,
    audience_id                 TEXT NOT NULL UNIQUE,
    last_assigned_counselor_id  TEXT,                       -- round-robin pointer; NULL before first assignment
    last_assigned_at            TIMESTAMP,
    added_at                    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_audience_pool ON counselor_pool_audience(pool_id);


-- 3. Per-(pool, audience, counselor) configuration.
-- This is the M*N matrix: each row stores the round-robin order,
-- the (future) monthly target, the active/inactive status, and the
-- backup counselor to redirect leads to when this counselor is
-- inactive. A counselor is "in" the pool when at least one row
-- exists for them.
CREATE TABLE IF NOT EXISTS counselor_pool_member (
    id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pool_id                     TEXT NOT NULL,
    audience_id                 TEXT NOT NULL,
    counselor_user_id           TEXT NOT NULL,
    display_order               INTEGER NOT NULL,                       -- position in round-robin sequence (per audience)
    monthly_target              INTEGER,                                 -- reserved for future use; no logic reads this yet
    status                      VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',   -- 'ACTIVE' | 'INACTIVE'
    backup_counselor_user_id    TEXT,                                    -- redirect target when status = 'INACTIVE'
    added_by                    TEXT,
    added_at                    TIMESTAMP DEFAULT NOW(),
    updated_at                  TIMESTAMP DEFAULT NOW(),
    UNIQUE (pool_id, audience_id, counselor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_member_pool_audience_order
    ON counselor_pool_member(pool_id, audience_id, display_order);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_member_counselor
    ON counselor_pool_member(counselor_user_id);


-- 4. Shift definitions (used only when pool.assignment_mode = 'TIME_BASED').
-- Each row is one block of the weekly schedule (day + start time + end
-- time). Admin draws the schedule once per pool; validation that the
-- 7 days are 24h-covered is enforced at the API layer, not in the DB.
-- Overlapping shifts are allowed (multi-counselor coverage handled by
-- the routing engine via intersection).
CREATE TABLE IF NOT EXISTS counselor_pool_shift (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pool_id         TEXT NOT NULL,
    day_of_week     VARCHAR(10) NOT NULL,                       -- 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
    start_time      TIME NOT NULL,                              -- wall-clock time, institute timezone (IST)
    end_time        TIME NOT NULL,
    label           VARCHAR(255),                                -- optional, e.g. 'Morning shift'
    status          VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',       -- 'ACTIVE' | 'INACTIVE'
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_shift_pool_day
    ON counselor_pool_shift(pool_id, day_of_week, start_time);


-- 5. Counselors on each shift.
-- A single shift can carry multiple counselors; this child table
-- holds those assignments. Within a shift, the routing engine
-- orders counselors by their counselor_pool_member.display_order
-- for the relevant audience.
CREATE TABLE IF NOT EXISTS counselor_pool_shift_member (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shift_id            TEXT NOT NULL,
    counselor_user_id   TEXT NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',   -- 'ACTIVE' | 'INACTIVE'
    added_at            TIMESTAMP DEFAULT NOW(),
    UNIQUE (shift_id, counselor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_shift_member_shift
    ON counselor_pool_shift_member(shift_id);

CREATE INDEX IF NOT EXISTS idx_counselor_pool_shift_member_counselor
    ON counselor_pool_shift_member(counselor_user_id);
