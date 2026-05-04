-- V228: Studio avatars can now reference a fal.ai built-in catalog (Argil / VEED)
-- in addition to user-uploaded custom faces.
--
-- For provider='custom' (legacy default): face_image_url is required.
-- For provider='argil' or 'veed': external_avatar_id holds the fal.ai enum value
-- (e.g. 'Mia outdoor (UGC)' for Argil, 'emily_vertical_primary' for VEED) and
-- face_image_url is null. preview_image_url is the URL the FE renders on cards
-- — for v1 we leave it null and the FE shows initials; once we self-host
-- thumbnails it becomes the s3 path to that frame.

ALTER TABLE studio_avatar
    ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'custom',
    ADD COLUMN IF NOT EXISTS external_avatar_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

ALTER TABLE studio_avatar
    ALTER COLUMN face_image_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_avatar_provider
    ON studio_avatar (institute_id, provider);

COMMENT ON COLUMN studio_avatar.provider IS
    'custom (user-uploaded face) | argil | veed — drives whether face_image_url or external_avatar_id is the source of truth.';
COMMENT ON COLUMN studio_avatar.external_avatar_id IS
    'fal.ai catalog enum value when provider != custom. Null for custom.';
COMMENT ON COLUMN studio_avatar.preview_image_url IS
    'URL the FE renders on the avatar card. For custom: same as face_image_url. For built-ins: self-hosted thumbnail (null in v1; FE shows initials).';
