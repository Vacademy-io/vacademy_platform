-- Update tag system with any missing constraints or modifications
-- This migration ensures the tag system is properly configured

-- Add any missing indexes that might not have been created in V2
CREATE INDEX IF NOT EXISTS idx_tags_institute_id ON public.tags USING btree (institute_id);
CREATE INDEX IF NOT EXISTS idx_tags_status ON public.tags USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tags_tag_name ON public.tags USING btree (tag_name);
CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON public.user_tags USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag_id ON public.user_tags USING btree (tag_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_institute_id ON public.user_tags USING btree (institute_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_status ON public.user_tags USING btree (status);

-- Ensure unique constraints exist
DROP INDEX IF EXISTS idx_user_tags_unique_active;
CREATE UNIQUE INDEX idx_user_tags_unique_active ON public.user_tags 
USING btree (user_id, tag_id, institute_id) 
WHERE status = 'ACTIVE';

DROP INDEX IF EXISTS idx_tags_unique_name_per_institute;
CREATE UNIQUE INDEX idx_tags_unique_name_per_institute ON public.tags 
USING btree (COALESCE(institute_id, ''), tag_name) 
WHERE status = 'ACTIVE';

-- Ensure trigger functions exist
CREATE OR REPLACE FUNCTION update_updated_at_tags()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION normalize_tag_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tag_name = TRIM(NEW.tag_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist
DROP TRIGGER IF EXISTS trigger_update_tags_updated_at ON public.tags;
CREATE TRIGGER trigger_update_tags_updated_at
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tags();

DROP TRIGGER IF EXISTS trigger_update_user_tags_updated_at ON public.user_tags;
CREATE TRIGGER trigger_update_user_tags_updated_at
    BEFORE UPDATE ON public.user_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tags();

DROP TRIGGER IF EXISTS trigger_normalize_tag_name ON public.tags;
CREATE TRIGGER trigger_normalize_tag_name
    BEFORE INSERT OR UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION normalize_tag_name();

-- Add any missing columns or constraints that might be needed
-- (This is a safety migration to ensure consistency)
