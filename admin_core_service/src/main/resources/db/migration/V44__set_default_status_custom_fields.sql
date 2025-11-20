-- 1. Fix existing null values (safe even if none exist)
UPDATE custom_fields
SET status = 'ACTIVE'
WHERE status IS NULL;

-- 2. Set DB default value
ALTER TABLE custom_fields
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- 3. Prevent future nulls
ALTER TABLE custom_fields
    ALTER COLUMN status SET NOT NULL;

-- 4. (Optional but recommended) Enforce valid values
-- Remove this block if you don't want enum-like restriction
ALTER TABLE custom_fields
    ADD CONSTRAINT custom_fields_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE'));
