-- YouTube auto-upload integration for BBB live-session recordings.
--
-- Architecture:
--   - One Vacademy GCP OAuth app, many institutes. Each institute admin
--     OAuth-connects their own YouTube channel; we store the per-institute
--     refresh token (encrypted) and upload recordings to *their* channel.
--   - Auto-upload is triggered when the existing BBB post-publish hook calls
--     /admin-core-service/live-sessions/provider/meeting/recording/complete.
--     That endpoint enqueues a youtube_upload_job; the scheduled worker picks
--     it up and uploads.
--   - Manual upload + retry are exposed via controller endpoints; any
--     session-authorised user can trigger.

-- One row per institute. Refresh tokens are AES-256-GCM encrypted via the
-- shared TokenEncryptionService (same key as Meta/Zoho OAuth tokens).
CREATE TABLE IF NOT EXISTS institute_youtube_credentials (
    institute_id            VARCHAR(255) PRIMARY KEY,
    refresh_token_encrypted TEXT NOT NULL,
    channel_id              VARCHAR(255),
    channel_title           VARCHAR(512),
    channel_thumbnail_url   TEXT,
    scopes                  TEXT,
    connected_by_user_id    VARCHAR(255),
    status                  VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_validated_at       TIMESTAMP WITH TIME ZONE,
    last_error              TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Per-institute upload defaults applied to every videos.insert call unless
-- overridden by the manual-upload payload.
--
-- feature_enabled vs auto_upload_enabled:
--   - feature_enabled is the institute-level master switch ("does this
--     institute want YouTube integration at all?"). Defaults to FALSE — an
--     institute must explicitly opt in from Settings → YouTube Integration
--     before the Connect button, defaults, or auto-upload behaviour kicks in.
--   - auto_upload_enabled is the fine-grained sub-toggle that decides whether
--     finished BBB recordings auto-enqueue. When master is on but auto is
--     off, recordings still queue via the manual "Upload to YouTube" button.
CREATE TABLE IF NOT EXISTS youtube_upload_defaults (
    institute_id              VARCHAR(255) PRIMARY KEY,
    feature_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    auto_upload_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    privacy_status            VARCHAR(16) NOT NULL DEFAULT 'unlisted',  -- public | unlisted | private
    embeddable                BOOLEAN NOT NULL DEFAULT TRUE,
    public_stats_viewable     BOOLEAN NOT NULL DEFAULT FALSE,
    made_for_kids             BOOLEAN NOT NULL DEFAULT FALSE,
    category_id               VARCHAR(8)  NOT NULL DEFAULT '27',         -- 27 = Education
    license                   VARCHAR(32) NOT NULL DEFAULT 'youtube',    -- youtube | creativeCommon
    default_language          VARCHAR(16),
    tags_csv                  TEXT,
    title_template            TEXT NOT NULL DEFAULT '{session_title} | {date}',
    description_template      TEXT,
    notify_subscribers        BOOLEAN NOT NULL DEFAULT FALSE,
    default_playlist_id       VARCHAR(255),
    created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One row per upload attempt. The same recording can be retried; we keep the
-- history rather than mutating a single row so admins can audit failures.
CREATE TABLE IF NOT EXISTS youtube_upload_job (
    id                    VARCHAR(36)  PRIMARY KEY,
    institute_id          VARCHAR(255) NOT NULL,
    session_schedule_id   VARCHAR(255) NOT NULL,
    recording_id          VARCHAR(255),                                  -- BBB recordingId from MeetingRecordingDTO
    recording_file_id     VARCHAR(255) NOT NULL,                          -- Vacademy media-service fileId (S3)
    status                VARCHAR(32)  NOT NULL DEFAULT 'QUEUED',         -- QUEUED | UPLOADING | DONE | FAILED | CANCELLED
    youtube_video_id      VARCHAR(64),
    youtube_video_url     TEXT,
    title                 TEXT,
    description           TEXT,
    privacy_status        VARCHAR(16),
    attempts              INT          NOT NULL DEFAULT 0,
    max_attempts          INT          NOT NULL DEFAULT 5,
    next_retry_at         TIMESTAMP WITH TIME ZONE,
    last_error            TEXT,
    last_error_code       VARCHAR(64),                                    -- e.g. quotaExceeded, invalidGrant
    triggered_by_user_id  VARCHAR(255),
    triggered_via         VARCHAR(16)  NOT NULL DEFAULT 'AUTO',           -- AUTO | MANUAL
    started_at            TIMESTAMP WITH TIME ZONE,
    finished_at           TIMESTAMP WITH TIME ZONE,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Worker picks up jobs by (status, next_retry_at). Index supports the hot path.
CREATE INDEX IF NOT EXISTS idx_youtube_upload_job_status_retry
    ON youtube_upload_job (status, next_retry_at);

-- Settings page lists jobs by institute, newest first.
CREATE INDEX IF NOT EXISTS idx_youtube_upload_job_institute_created
    ON youtube_upload_job (institute_id, created_at DESC);

-- Per-recording status badge needs O(1) lookup by (schedule, recording).
CREATE INDEX IF NOT EXISTS idx_youtube_upload_job_schedule_recording
    ON youtube_upload_job (session_schedule_id, recording_id);

-- Prevent duplicate active jobs for the same recording. Two QUEUED/UPLOADING
-- jobs for the same fileId would race and either double-upload or both fail
-- with conflicting state. DONE/FAILED rows are kept for audit, so the partial
-- unique index is filtered.
CREATE UNIQUE INDEX IF NOT EXISTS uq_youtube_upload_job_active_file
    ON youtube_upload_job (recording_file_id)
    WHERE status IN ('QUEUED', 'UPLOADING');
