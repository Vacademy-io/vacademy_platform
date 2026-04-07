CREATE TABLE IF NOT EXISTS ota_bundle_version (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version             VARCHAR(20) NOT NULL UNIQUE,
    platform            VARCHAR(10) NOT NULL DEFAULT 'ALL',
    bundle_file_id      TEXT NOT NULL,
    bundle_download_url TEXT NOT NULL,
    checksum            VARCHAR(64) NOT NULL,
    bundle_size_bytes   BIGINT,
    min_native_version  VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    force_update        BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    target_app_ids      TEXT,
    release_notes       TEXT,
    published_by        TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ota_bundle_active
    ON ota_bundle_version (is_active, platform, created_at DESC);
