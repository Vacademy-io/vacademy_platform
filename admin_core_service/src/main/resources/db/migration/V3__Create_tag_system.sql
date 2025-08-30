-- Create tag system tables

-- Tags table: stores tag definitions
CREATE TABLE public.tags (
    id varchar(255) NOT NULL,
    tag_name varchar(255) NOT NULL,
    institute_id varchar(255) NULL, -- NULL for default/system tags
    description text NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id varchar(255) NULL,
    status varchar(255) DEFAULT 'ACTIVE' NOT NULL,
    CONSTRAINT tags_pkey PRIMARY KEY (id)
);

-- User tags table: stores user-tag associations
CREATE TABLE public.user_tags (
    id varchar(255) NOT NULL,
    user_id varchar(255) NOT NULL,
    tag_id varchar(255) NOT NULL,
    institute_id varchar(255) NOT NULL,
    status varchar(255) DEFAULT 'ACTIVE' NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id varchar(255) NULL,
    CONSTRAINT user_tags_pkey PRIMARY KEY (id),
    CONSTRAINT fk_user_tags_tag_id FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);

-- Indexes for performance
CREATE INDEX idx_tags_institute_id ON public.tags USING btree (institute_id);
CREATE INDEX idx_tags_status ON public.tags USING btree (status);
CREATE INDEX idx_tags_tag_name ON public.tags USING btree (tag_name);
CREATE INDEX idx_user_tags_user_id ON public.user_tags USING btree (user_id);
CREATE INDEX idx_user_tags_tag_id ON public.user_tags USING btree (tag_id);
CREATE INDEX idx_user_tags_institute_id ON public.user_tags USING btree (institute_id);
CREATE INDEX idx_user_tags_status ON public.user_tags USING btree (status);

-- Unique constraint to prevent duplicate user-tag combinations
CREATE UNIQUE INDEX idx_user_tags_unique_active ON public.user_tags 
USING btree (user_id, tag_id, institute_id) 
WHERE status = 'ACTIVE';

-- Unique constraint for tag names per institute (including default tags)
CREATE UNIQUE INDEX idx_tags_unique_name_per_institute ON public.tags 
USING btree (COALESCE(institute_id, ''), tag_name) 
WHERE status = 'ACTIVE';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_tags()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tags_updated_at
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tags();

CREATE TRIGGER trigger_update_user_tags_updated_at
    BEFORE UPDATE ON public.user_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tags();

-- Trigger to trim and normalize tag names
CREATE OR REPLACE FUNCTION normalize_tag_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tag_name = TRIM(NEW.tag_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_tag_name
    BEFORE INSERT OR UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION normalize_tag_name();
