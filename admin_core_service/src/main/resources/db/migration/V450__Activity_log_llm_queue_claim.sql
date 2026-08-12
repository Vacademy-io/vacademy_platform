-- V450: make the LLM analytics queue safe to run from four replicas, and stop
-- permanently-failing logs from being retried forever.
--
-- Background (prod, 2026-08-12): after the V449 model swap, analytics spend went UP,
-- not down. Two multipliers, both visible in the logs:
--
--   1. @Scheduled has no leader election and no row claim, so all four admin-core
--      replicas selected the SAME oldest-20 logs every hour and each called the LLM on
--      them. Measured from per-pod logs: 8 activity log ids were processed by 4 distinct
--      pods and 5 more by 3 pods - a straight 3-4x on every call.
--   2. The scheduler selects `status IN ('raw','failed')`, so a log that can never
--      succeed came back every hour forever. Log 470b43e2-39d0-4054-9f00-715285960b2d
--      was still being retried more than five hours after its first failure.
--
-- The claim is done with SELECT ... FOR UPDATE SKIP LOCKED plus a 'processing' status,
-- so replicas take disjoint batches. processing_attempts bounds the retries.

-- ---------------------------------------------------------------------------
-- Retry counter.
--
-- Deliberately NOT mapped on the ActivityLog entity: the queue mechanics are driven
-- entirely by native statements, and ActivityLog is save()d elsewhere in the processor
-- (see updateEngagement) which would reset a mapped field back to 0. The DB default
-- covers inserts.
-- ---------------------------------------------------------------------------
ALTER TABLE activity_log
    ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Queue index. Partial over the three live queue states so it stays tiny next to the
-- ~78K rows whose status is NULL and which never enter the pipeline.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_log_llm_queue
    ON activity_log (created_at)
    WHERE status IN ('raw', 'failed', 'processing');

-- ---------------------------------------------------------------------------
-- Release anything the old code left mid-flight, and give already-failed logs one
-- bounded run under the new attempt cap rather than resurrecting them indefinitely.
-- ---------------------------------------------------------------------------
UPDATE activity_log
   SET processing_attempts = 1
 WHERE status = 'failed'
   AND processing_attempts = 0;
