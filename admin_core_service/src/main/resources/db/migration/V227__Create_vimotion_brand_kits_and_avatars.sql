-- V227: Vimotion brand kits + studio avatars.
-- Brand kits extend the existing single-config (institute.setting_json.VIDEO_STYLE +
-- VIDEO_BRANDING) into multiple swappable kits per institute, with one default.
-- Lookups fall back to the legacy setting_json path when no kit exists.
--
-- Studio avatars persist host-avatar configurations (face image + voice) so users
-- can select a saved avatar at video-gen time instead of repasting URLs every run.
--
-- FK behavior matches existing convention on institutes(id): NO ACTION on delete.
-- Institute deletion is gated by application logic; cascade on these new tables
-- would silently diverge from siblings like form_webhook_connector / audience.

CREATE TABLE IF NOT EXISTS brand_kit (
    id              VARCHAR(64)  PRIMARY KEY,
    institute_id    VARCHAR(255) NOT NULL REFERENCES institutes(id),
    name            VARCHAR(120) NOT NULL,
    is_default      BOOLEAN      NOT NULL DEFAULT FALSE,

    -- style (mirrors VideoStyleConfig + palette extension)
    background_type VARCHAR(16)  NOT NULL DEFAULT 'white',  -- 'white' | 'black' (UI labels: Light/Dark)
    palette_json    JSONB        NOT NULL DEFAULT '{}'::jsonb, -- { primary, secondary, accent, background }
    heading_font    VARCHAR(64),
    body_font       VARCHAR(64),
    layout_theme    VARCHAR(64),                              -- id from ai_service VIDEO_TEMPLATES catalog
    logo_file_id    VARCHAR(255),

    -- branding (mirrors VideoBrandingConfig)
    intro_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    outro_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    watermark_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,

    created_by      VARCHAR(255),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_kit_institute ON brand_kit (institute_id);

-- At most one default brand kit per institute.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_kit_default_per_institute
    ON brand_kit (institute_id) WHERE is_default = TRUE;

COMMENT ON TABLE  brand_kit IS 'Vimotion brand kits — swappable bundles of palette/fonts/layout/intro/outro/watermark per institute.';
COMMENT ON COLUMN brand_kit.background_type IS 'Storage value (''white'' | ''black''); UI labels these as Light/Dark.';
COMMENT ON COLUMN brand_kit.layout_theme IS 'Layout theme id matching ai_service VIDEO_TEMPLATES catalog (Whiteboard, Cerulean, Glamour, etc.).';

-- Auto-update brand_kit.updated_at on row modification (matches V209/V79 convention).
CREATE OR REPLACE FUNCTION update_brand_kit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brand_kit_updated_at ON brand_kit;
CREATE TRIGGER trg_brand_kit_updated_at
    BEFORE UPDATE ON brand_kit
    FOR EACH ROW EXECUTE FUNCTION update_brand_kit_updated_at();

CREATE TABLE IF NOT EXISTS studio_avatar (
    id              VARCHAR(64)  PRIMARY KEY,
    institute_id    VARCHAR(255) NOT NULL REFERENCES institutes(id),
    name            VARCHAR(120) NOT NULL,
    face_image_url  TEXT         NOT NULL,
    description     TEXT,

    -- TTS voice metadata (validated client-side against /external/video/v1/tts/voices)
    voice_id        VARCHAR(120),
    voice_provider  VARCHAR(32),  -- 'google' | 'sarvam' | 'edge'
    voice_language  VARCHAR(32),
    voice_gender    VARCHAR(16),

    created_by      VARCHAR(255),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_studio_avatar_institute ON studio_avatar (institute_id);

COMMENT ON TABLE  studio_avatar IS 'Saved host-avatar profiles per studio. Hydrated into host.avatar payload at video-gen time.';
COMMENT ON COLUMN studio_avatar.voice_id IS 'TTS voice id from ai_service voices catalog. Optional — if null, voice falls back to per-generation defaults.';

CREATE OR REPLACE FUNCTION update_studio_avatar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_studio_avatar_updated_at ON studio_avatar;
CREATE TRIGGER trg_studio_avatar_updated_at
    BEFORE UPDATE ON studio_avatar
    FOR EACH ROW EXECUTE FUNCTION update_studio_avatar_updated_at();
