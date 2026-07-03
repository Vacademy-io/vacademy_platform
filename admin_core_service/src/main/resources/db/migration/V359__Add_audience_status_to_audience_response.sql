-- Add audience_status column to audience_response for soft-deleting leads.
-- ACTIVE  = normal, visible, eligible for promotional/automated sends
-- INACTIVE = admin soft-deleted; hidden from lead views and send recipient lists
-- Kept separate from overall_status (opt-out/engagement) and conversion_status.

ALTER TABLE audience_response
ADD COLUMN audience_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- Existing rows are active leads (DEFAULT already backfills; explicit for clarity).
UPDATE audience_response
SET audience_status = 'ACTIVE'
WHERE audience_status IS NULL;

-- Most lead reads filter by status; index it.
CREATE INDEX idx_audience_response_audience_status
ON audience_response(audience_status);
