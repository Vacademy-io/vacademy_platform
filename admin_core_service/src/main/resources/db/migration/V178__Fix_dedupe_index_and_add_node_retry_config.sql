-- Fix: add proper index for DedupeServiceImpl.seen() query (was doing full-table scan)
CREATE INDEX IF NOT EXISTS idx_node_dedupe_operation_key
    ON node_dedupe_record(operation_key);

-- Add retry configuration to node_template for per-node retry support
ALTER TABLE node_template ADD COLUMN IF NOT EXISTS retry_config JSONB;
