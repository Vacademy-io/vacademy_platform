-- Add updated_by_user_id to slide and ensure created_at/updated_at have safe
-- defaults so legacy rows and any non-Hibernate insert paths still get valid
-- timestamps. created_by_user_id and the timestamps already exist on slide.

ALTER TABLE slide
    ADD COLUMN IF NOT EXISTS updated_by_user_id VARCHAR(255);

ALTER TABLE slide
    ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE slide
    ALTER COLUMN updated_at SET DEFAULT now();
