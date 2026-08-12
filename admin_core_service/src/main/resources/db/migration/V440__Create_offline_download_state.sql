-- Offline Content Download & Sync -- Part A5: download-state telemetry.
--
-- Fed by DOWNLOAD_STATE events through the same offline-sync batch endpoint
-- (OfflineDownloadStateService). One row per (device, slide) -- the latest
-- reported state wins, guarded by client_ts monotonicity against updated_at
-- so an out-of-order replay of an older DOWNLOAD_STATE event can't clobber a
-- newer one (see OfflineDownloadStateService.upsert()).
CREATE TABLE IF NOT EXISTS offline_download_state (
    id                    VARCHAR(255) PRIMARY KEY,
    device_id             VARCHAR(255) NOT NULL,
    user_id               VARCHAR(255) NOT NULL,
    package_session_id    VARCHAR(255),
    slide_id              VARCHAR(255) NOT NULL,
    status                VARCHAR(16)  NOT NULL, -- DOWNLOADED | DELETED
    client_ts             TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    ALTER TABLE offline_download_state
        ADD CONSTRAINT uq_offline_download_state_device_slide
        UNIQUE (device_id, slide_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Admin telemetry: GET /admin/offline/v1/telemetry/downloads?packageSessionId=
-- (learnersWithDownloads / activeDevices / perSlideCounts).
CREATE INDEX IF NOT EXISTS idx_offline_download_state_package_session
    ON offline_download_state (package_session_id, status);
