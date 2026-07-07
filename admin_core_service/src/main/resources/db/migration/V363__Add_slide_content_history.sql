-- Append-only audit trail for slide body content (document_slide / video / audio_slide).
-- Captures the BEFORE image of the draft + published columns on every content-changing
-- UPDATE, so a bad/accidental overwrite (from any writer, including out-of-service raw
-- SQL) becomes recoverable with a single query instead of forensic archaeology.
--
-- There was no history/audit table for slide content before this; slide bodies were
-- overwritten in place with no way to recover.

CREATE TABLE IF NOT EXISTS slide_content_history (
    id              BIGSERIAL PRIMARY KEY,
    source_table    TEXT         NOT NULL,      -- 'document_slide' | 'video' | 'audio_slide'
    source_id       VARCHAR(255) NOT NULL,      -- id of the changed content row
    draft_value     TEXT,                       -- previous draft column (data / url / audio_file_id)
    published_value TEXT,                       -- previous published column (published_data / published_url / published_audio_file_id)
    changed_by      VARCHAR(255),               -- app user id if set via app.user_id GUC, else null
    changed_at      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slide_content_history_source
    ON slide_content_history (source_table, source_id, changed_at DESC);

-- document_slide: snapshot old (data, published_data) when either changes
CREATE OR REPLACE FUNCTION fn_document_slide_content_history() RETURNS trigger AS $$
BEGIN
    IF (OLD.data IS DISTINCT FROM NEW.data)
       OR (OLD.published_data IS DISTINCT FROM NEW.published_data) THEN
        INSERT INTO slide_content_history (source_table, source_id, draft_value, published_value, changed_by)
        VALUES ('document_slide', OLD.id, OLD.data, OLD.published_data, current_setting('app.user_id', true));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_slide_content_history ON document_slide;
CREATE TRIGGER trg_document_slide_content_history
    BEFORE UPDATE ON document_slide
    FOR EACH ROW EXECUTE FUNCTION fn_document_slide_content_history();

-- video: snapshot old (url, published_url) when either changes
CREATE OR REPLACE FUNCTION fn_video_slide_content_history() RETURNS trigger AS $$
BEGIN
    IF (OLD.url IS DISTINCT FROM NEW.url)
       OR (OLD.published_url IS DISTINCT FROM NEW.published_url) THEN
        INSERT INTO slide_content_history (source_table, source_id, draft_value, published_value, changed_by)
        VALUES ('video', OLD.id, OLD.url, OLD.published_url, current_setting('app.user_id', true));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_slide_content_history ON video;
CREATE TRIGGER trg_video_slide_content_history
    BEFORE UPDATE ON video
    FOR EACH ROW EXECUTE FUNCTION fn_video_slide_content_history();

-- audio_slide: snapshot old (audio_file_id, published_audio_file_id) when either changes
CREATE OR REPLACE FUNCTION fn_audio_slide_content_history() RETURNS trigger AS $$
BEGIN
    IF (OLD.audio_file_id IS DISTINCT FROM NEW.audio_file_id)
       OR (OLD.published_audio_file_id IS DISTINCT FROM NEW.published_audio_file_id) THEN
        INSERT INTO slide_content_history (source_table, source_id, draft_value, published_value, changed_by)
        VALUES ('audio_slide', OLD.id, OLD.audio_file_id, OLD.published_audio_file_id, current_setting('app.user_id', true));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audio_slide_content_history ON audio_slide;
CREATE TRIGGER trg_audio_slide_content_history
    BEFORE UPDATE ON audio_slide
    FOR EACH ROW EXECUTE FUNCTION fn_audio_slide_content_history();
