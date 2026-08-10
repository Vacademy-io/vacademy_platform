-- Offline Content Download & Sync -- Part A2: per-package-session manifest version.
--
-- The client stores the last-seen version and re-fetches the full manifest on
-- mismatch (diffing by slideId + asset checksum). Every content/permission
-- mutation that could change what a learner sees offline must bump this row --
-- see OfflineManifestVersionService.bump() and its call sites (offline rule
-- writes, SlideService.updateSlideStatus, PackageSettingService's
-- offlineDefaultEnabled toggle).
CREATE TABLE IF NOT EXISTS offline_manifest_version (
    package_session_id VARCHAR(255) PRIMARY KEY,
    version             BIGINT       NOT NULL DEFAULT 1,
    last_reason         VARCHAR(255),
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
