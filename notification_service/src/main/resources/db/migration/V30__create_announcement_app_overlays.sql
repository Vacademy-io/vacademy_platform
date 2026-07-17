-- APP_OVERLAY announcement mode: full-screen scrollable HTML shown to learners on next app open.
-- One row per announcement configured with the APP_OVERLAY mode. Dismiss-once is tracked via
-- message_interactions (interaction_type = 'DISMISSED'), same as other in-app modes.
CREATE TABLE IF NOT EXISTS announcement_app_overlays (
    id VARCHAR(255) PRIMARY KEY,
    announcement_id VARCHAR(255) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1,
    show_until TIMESTAMP NULL,
    is_dismissible BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcement_app_overlays_announcement_id
    ON announcement_app_overlays (announcement_id);
