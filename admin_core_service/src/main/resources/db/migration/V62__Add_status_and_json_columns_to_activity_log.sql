-- Add status, raw_json, and processed_json columns to activity_log table

ALTER TABLE activity_log
ADD COLUMN status VARCHAR(50),
ADD COLUMN raw_json TEXT,
ADD COLUMN processed_json TEXT;

-- Add index on status column for faster filtering
CREATE INDEX idx_activity_log_status ON activity_log USING btree (status) WHERE status IS NOT NULL;
