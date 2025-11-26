-- Rename username column to user_id
ALTER TABLE public.user_announcement_settings
    RENAME COLUMN username TO user_id;

-- Add institute_id column (temporary default for existing rows)
ALTER TABLE public.user_announcement_settings
    ADD COLUMN IF NOT EXISTS institute_id varchar(255);

UPDATE public.user_announcement_settings
SET institute_id = COALESCE(institute_id, 'GLOBAL');

ALTER TABLE public.user_announcement_settings
    ALTER COLUMN institute_id SET NOT NULL;

-- Drop old unique constraint and indexes
ALTER TABLE public.user_announcement_settings
    DROP CONSTRAINT IF EXISTS uq_user_announcement_settings;

DROP INDEX IF EXISTS idx_user_announcement_settings_username;

-- Add new unique constraint including institute_id
ALTER TABLE public.user_announcement_settings
    ADD CONSTRAINT uq_user_announcement_settings UNIQUE (user_id, institute_id, channel, source_identifier);

-- Helpful lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_announcement_settings_user
    ON public.user_announcement_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_user_announcement_settings_institute
    ON public.user_announcement_settings (institute_id);

