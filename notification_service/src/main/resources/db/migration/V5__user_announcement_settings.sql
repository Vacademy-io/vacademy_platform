-- Create table for storing per-username announcement channel preferences
CREATE TABLE IF NOT EXISTS public.user_announcement_settings (
    id varchar(255) PRIMARY KEY,
    username varchar(255) NOT NULL,
    channel varchar(50) NOT NULL,
    source_identifier varchar(255) NOT NULL DEFAULT 'DEFAULT',
    is_unsubscribed boolean NOT NULL DEFAULT false,
    unsubscribed_at timestamp,
    metadata jsonb,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_user_announcement_settings UNIQUE (username, channel, source_identifier)
);

CREATE INDEX idx_user_announcement_settings_username
    ON public.user_announcement_settings USING btree (username);

CREATE INDEX idx_user_announcement_settings_channel
    ON public.user_announcement_settings USING btree (channel);

