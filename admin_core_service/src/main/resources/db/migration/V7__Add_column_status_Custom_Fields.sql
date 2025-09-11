-- Step 1: Add the new column "status" with default value 'ACTIVE'
ALTER TABLE custom_fields
ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE';

-- Step 2 (optional): Ensure existing rows are set to 'ACTIVE'
UPDATE custom_fields
SET status = 'ACTIVE'
WHERE status IS NULL;
