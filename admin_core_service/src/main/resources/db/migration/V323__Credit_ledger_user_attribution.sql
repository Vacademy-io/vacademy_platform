-- ================================================================================
-- V323: Per-user attribution on the credit ledger (academy-credits Phase 3)
--
-- Until now credit_transactions was institute-scoped (institute_id + granted_by).
-- These columns let us answer "which user spent credits" from both the admin/
-- teacher side and the learner side, and (for work done ON a learner's behalf,
-- e.g. evaluating their paper) record the subject separately from the actor.
--
--   user_id          verified actor who triggered the spend/grant
--   user_role        ADMIN | TEACHER | LEARNER | SYSTEM | PLATFORM_BILLING | UNVERIFIED
--   subject_user_id  who the work was ABOUT, when != actor (e.g. evaluated learner)
--
-- Forward-only: historical rows stay NULL on these columns. Per-user analytics
-- read COALESCE(subject_user_id, user_id) for "spent on a learner" views.
--
-- NOTE (prod table-ownership gotcha): credit_transactions is altered the same
-- plain way as V189/V243 (the proven pattern for this table). If a future env
-- hits SQLSTATE 42501 "must be owner", that's the cluster-wide ownership drift
-- documented in ops notes — fix with the per-object ALTER ... OWNER TO vacademy
-- loop at deploy, not by changing this migration.
-- ================================================================================

ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS user_id         VARCHAR(255);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS user_role       VARCHAR(32);
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS subject_user_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
    ON credit_transactions (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_inst_user_created
    ON credit_transactions (institute_id, user_id, created_at);
