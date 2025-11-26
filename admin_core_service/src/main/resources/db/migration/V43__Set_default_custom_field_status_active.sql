-- 1. Fix any existing nulls (safe even if none exist)
UPDATE institute_custom_fields
SET status = 'ACTIVE'
WHERE status IS NULL;

-- 2. Set default value at DB level
ALTER TABLE institute_custom_fields
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- 3. Prevent nulls entirely
ALTER TABLE institute_custom_fields
    ALTER COLUMN status SET NOT NULL;
