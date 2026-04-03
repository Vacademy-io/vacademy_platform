-- Credit System Improvements:
-- 1. Update video pricing from flat-rate to token-based
-- 2. Add batch_id column to credit_transactions for grouping charges

-- Ensure video pricing row exists with token-based config
-- (upsert: update if exists, insert if not)
INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES ('video', 0.5, 0.0001, 0.5, 'tokens', 'Video generation (token-based pricing per stage)', TRUE)
ON CONFLICT (request_type)
DO UPDATE SET base_cost = 0.5,
             token_rate = 0.0001,
             minimum_charge = 0.5,
             unit_type = 'tokens',
             description = 'Video generation (token-based pricing per stage)';

-- Add batch_id for grouping related transactions (e.g., all charges for one video)
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS batch_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_batch_id ON credit_transactions(batch_id);
