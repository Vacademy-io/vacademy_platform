-- Track B: teacher flow to link a session recording / uploaded class material to
-- one or more course chapters. Each row records ONE created slide for ONE chapter;
-- when a recording/material is added to N chapters, N rows are written (after
-- dedup by chapter_id — chapters shared across package sessions get exactly one
-- slide, but still one link row per package_session_id destination it serves).
-- Doubles as: idempotency guard (do not re-create the slide on a repeat click),
-- "already added" UI state, and per-session material history.
CREATE TABLE IF NOT EXISTS live_session_content_links (
    id                  VARCHAR(36) NOT NULL,
    session_id          VARCHAR(36) NOT NULL,
    schedule_id         VARCHAR(36),
    recording_id        VARCHAR(255),
    content_type        VARCHAR(20) NOT NULL,
    slide_id            VARCHAR(36) NOT NULL,
    chapter_id          VARCHAR(36) NOT NULL,
    package_session_id  VARCHAR(36) NOT NULL,
    created_by_user_id  VARCHAR(36),
    status              VARCHAR(20) DEFAULT 'ACTIVE',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT live_session_content_links_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_content_links_session_id
    ON live_session_content_links (session_id);

-- Idempotency: a given recording must not be linked into the same chapter twice.
-- Partial (recording_id IS NOT NULL) since uploaded material rows have no
-- recording_id and should not be constrained by this key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_session_content_links_schedule_recording_chapter
    ON live_session_content_links (schedule_id, recording_id, chapter_id)
    WHERE recording_id IS NOT NULL;
