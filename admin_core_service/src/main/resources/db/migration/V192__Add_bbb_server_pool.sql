-- =====================================================================
-- V192: BBB Server Pool — Multi-server support
-- =====================================================================
-- Enables running multiple BBB servers in parallel with load-balanced
-- meeting placement. Each server has its own snapshot chain, domain,
-- API credentials, and meeting capacity limit.
-- =====================================================================

-- ── 1. Server pool registry ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bbb_server_pool (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                VARCHAR(30)  NOT NULL UNIQUE,       -- "bbb-pool-1", "bbb-pool-2"
    priority            INT          NOT NULL DEFAULT 1,     -- lower = start first, fill first
    server_type         VARCHAR(20)  NOT NULL,               -- "ccx33", "cpx42"
    server_name         VARCHAR(50)  NOT NULL,               -- Hetzner server name
    domain              VARCHAR(100) NOT NULL,               -- "meet.vacademy.io"
    api_url             VARCHAR(255),                        -- "https://meet.vacademy.io/bigbluebutton/api"
    secret              VARCHAR(255),                        -- BBB shared secret
    hetzner_server_id   BIGINT,                              -- Hetzner server ID (null when deleted)
    snapshot_desc       VARCHAR(100) NOT NULL,               -- "vacademy-bbb-pool-1"
    location            VARCHAR(10)  DEFAULT 'sin',          -- Hetzner datacenter
    max_meetings        INT          NOT NULL DEFAULT 5,     -- max concurrent meetings on this server
    active_meetings     INT          NOT NULL DEFAULT 0,     -- currently running meetings (updated on create/end)
    status              VARCHAR(20)  NOT NULL DEFAULT 'STOPPED',
                        -- STOPPED | STARTING | RUNNING | STOPPING | ERROR
    health_status       VARCHAR(20)  DEFAULT 'UNKNOWN',      -- HEALTHY | DEGRADED | DOWN | UNKNOWN
    last_health_check   TIMESTAMP,
    enabled             BOOLEAN      NOT NULL DEFAULT TRUE,   -- false = skip in start/stop/routing
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW()
);

-- ── 2. App-level key-value config ───────────────────────────────────
-- Used for settings like "how many servers to start daily".
-- Avoids needing env vars or redeployment for runtime config changes.
CREATE TABLE IF NOT EXISTS app_config (
    config_key   VARCHAR(50)  PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description  VARCHAR(255),
    updated_at   TIMESTAMP    DEFAULT NOW()
);

INSERT INTO app_config (config_key, config_value, description)
VALUES ('bbb_servers_to_start', '1', 'Number of BBB servers to start on daily schedule (by priority order)')
ON CONFLICT (config_key) DO NOTHING;

-- ── 3. Link meetings to specific servers ────────────────────────────
-- Nullable: legacy schedules won't have this, fallback to platform-wide config.
ALTER TABLE session_schedules
    ADD COLUMN IF NOT EXISTS bbb_server_id UUID REFERENCES bbb_server_pool(id);
