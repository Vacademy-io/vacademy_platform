-- Subject tags for questions: institute-scoped tag vocabulary + read-path indexes.

-- 1. Reconcile timestamp columns the CommunityTag / EntityTag entities already map
--    (the live DB may already have them; IF NOT EXISTS keeps this idempotent).
ALTER TABLE public.tags        ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tags        ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.entity_tags ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.entity_tags ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT CURRENT_TIMESTAMP;

-- 2. Institute scoping for the tag vocabulary.
--    Existing rows stay institute_id = NULL and are treated as legacy/global.
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS institute_id varchar(255) NULL;

-- Replace the global unique-on-name constraint with per-institute uniqueness,
-- so two institutes can own the same tag name independently.
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_tag_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_institute_name
    ON public.tags (institute_id, tag_name)
    WHERE institute_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_global_name
    ON public.tags (tag_name)
    WHERE institute_id IS NULL;

-- 3. Read-path indexes for tag filtering / listing.
CREATE INDEX IF NOT EXISTS idx_entity_tags_source_tag ON public.entity_tags (tag_source, tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity     ON public.entity_tags (entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_tags_institute         ON public.tags (institute_id);
