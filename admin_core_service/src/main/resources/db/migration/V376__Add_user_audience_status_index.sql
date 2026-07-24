-- Composite index supporting the lead soft-delete reads added alongside it.
--
-- V359 added audience_status + a standalone index on it. That index alone is not
-- selective enough for the Counsellor Workbench guard, which asks per profile row:
--     EXISTS (SELECT 1 FROM audience_response ar
--              WHERE ar.user_id = ulp.user_id AND ar.audience_status = 'ACTIVE')
-- With only (user_id) and (audience_status) available separately, that probe costs
-- ~2.4x on a paginated workbench page and ~6.6x on an aggregate. Measured on a
-- 59,782-profile institute: 10.2ms -> 24.7ms paginated, 6.4ms -> 42.3ms aggregate.
-- With this composite index the same probes land at 14.9ms and 27.7ms — the
-- paginated workbench path (the one that actually gets the guard) drops to ~+4.7ms
-- over baseline, which is what makes deriving the flag cheaper than denormalizing
-- it onto user_lead_profile.
--
-- Column order matters: user_id first (high cardinality, the join key), then
-- audience_status (2 values) as the filtering suffix.
CREATE INDEX IF NOT EXISTS idx_audience_response_user_audience_status
ON audience_response (user_id, audience_status);
