-- V465: index the tables that production spends the most time sequentially scanning.
--
-- Evidence: pg_stat_user_tables over the 18-day window since the stats reset
-- (2026-08-03 -> 2026-08-21). Every table below was either missing an index
-- entirely apart from its primary key, or had no index whose LEADING column
-- matched the predicate the code actually filters on -- so the planner fell back
-- to a sequential scan.
--
-- All of these tables are small (4-28 MB, under 60k rows). The cost is not table
-- size, it is scan FREQUENCY: they are scanned millions of times. A plain
-- CREATE INDEX therefore holds its ACCESS EXCLUSIVE lock for only milliseconds,
-- which is why this follows V452 in using a normal build rather than
-- CONCURRENTLY (which cannot run inside Flyway's transaction anyway).


-- ---------------------------------------------------------------------------
-- 1. ai_call_result.call_log_id  --  72.1 BILLION rows read via seq scan
-- ---------------------------------------------------------------------------
-- TelephonyCallLogRepository.findMostRecentOutboundByPhone() and
-- findOutboundByPhoneNearest() both carry:
--     AND NOT EXISTS (SELECT 1 FROM ai_call_result r WHERE r.call_log_id = t.id)
-- The table already has 8 indexes, but none covers call_log_id, so the anti-join
-- plans as "Materialize -> Seq Scan on ai_call_result" and re-reads all ~9.7k
-- rows for every candidate telephony_call_log row. 7,604,891 sequential scans
-- reading 72,100,308,208 rows -- by far the single largest source of load.
--
-- Partial, because 7,963 of 9,727 rows have a NULL call_log_id (orphan webhooks
-- that arrive before the provider's upload are expected), and a NULL row can
-- never satisfy the equality above. That keeps the index to roughly a fifth of
-- the rows.
CREATE INDEX IF NOT EXISTS idx_acr_call_log_id
    ON ai_call_result (call_log_id)
    WHERE call_log_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. module_chapter_mapping  --  32.3 BILLION rows read, idx_scan = 0
-- ---------------------------------------------------------------------------
-- This table had exactly one index (the primary key on id) and its idx_scan
-- counter was ZERO: no index had ever been used on it. 32 native queries join it
-- on module_id or chapter_id -- ChapterRepository, ActivityLogRepository,
-- PulseRepository, LearnerOperationRepository and others -- so every one of them
-- sequentially scanned. 2,316,180 scans reading 32,319,167,876 rows.
--
-- Two single-column indexes rather than one composite: the joins go in both
-- directions (module -> chapters and chapter -> modules) and neither column is
-- consistently the leading predicate.
--
-- Note this table has NO status column (id, chapter_id, module_id, created_at,
-- updated_at), so unlike its sibling mapping tables it takes no
-- "status <> 'DELETED'" partial predicate.
CREATE INDEX IF NOT EXISTS idx_mcm_module_id
    ON module_chapter_mapping (module_id);

CREATE INDEX IF NOT EXISTS idx_mcm_chapter_id
    ON module_chapter_mapping (chapter_id);


-- ---------------------------------------------------------------------------
-- 3. institute_custom_fields  --  11.0 BILLION rows read
-- ---------------------------------------------------------------------------
-- Primary key only, 58k rows, 198,603 scans reading 11,082,746,417 rows.
-- The two predicate shapes in CustomFieldRepository / InstituteCustomFieldRepository:
--     WHERE icf.institute_id = :instituteId AND icf.status = :status
--     ON icf.type = 'SESSION' AND icf.type_id = s.id AND icf.status = 'ACTIVE'
-- status is kept as a trailing column rather than a partial-index predicate
-- because callers bind it as a parameter, so the value is not constant.
CREATE INDEX IF NOT EXISTS idx_icf_institute_status
    ON institute_custom_fields (institute_id, status);

CREATE INDEX IF NOT EXISTS idx_icf_type_type_id_status
    ON institute_custom_fields (type, type_id, status);


-- ---------------------------------------------------------------------------
-- 4. payment_log.user_plan_id  --  5.6 BILLION rows read
-- ---------------------------------------------------------------------------
-- payment_log already has indexes on id, status, order_status, tracking_id and
-- (user_id, created_at) -- but user_plan_id, which the native queries filter on
-- more than any other column, leads none of them. 354,204 scans reading
-- 5,617,832,327 rows.
--
-- created_at DESC trails the key because these lookups are consistently
-- "the payment log rows for this plan, newest first".
CREATE INDEX IF NOT EXISTS idx_payment_log_user_plan_created
    ON payment_log (user_plan_id, created_at DESC);


-- Deliberately NOT indexed: subject_module_mapping.module_id, despite 635M rows
-- read. Its module_id references are almost all join conditions
-- (smm.module_id = m.id and similar), where sequentially scanning an 8,878-row
-- 3 MB table as the inner side of a hash join is already the correct plan. A
-- single-value lookup likewise already uses the existing
-- idx_subject_module_mapping (subject_id, module_id). Only the one
-- "IN (:moduleIds)" shape falls back to a scan, which does not justify the write
-- cost of another index on this table.


-- ---------------------------------------------------------------------------
-- 5. web_hook  --  5.5 BILLION rows read
-- ---------------------------------------------------------------------------
-- Primary key only. WebHookRepository.findByCreatedAtBetweenAndStatusAndVendor
-- is the sole query and filters:
--     WHERE w.createdAt BETWEEN :startTime AND :endTime
--       AND w.status = :status AND w.vendor = :vendor
-- Equality columns lead, the range column trails -- a btree can only use one
-- range predicate, and only as the final column.
CREATE INDEX IF NOT EXISTS idx_web_hook_vendor_status_created
    ON web_hook (vendor, status, created_at);


-- ---------------------------------------------------------------------------
-- 6. schedule_notifications.session_id  --  733 MILLION rows read
-- ---------------------------------------------------------------------------
-- Only the primary key and the idempotency-key unique index exist; neither
-- serves a lookup by session_id. 40,746 scans reading 730,801,031 rows.
CREATE INDEX IF NOT EXISTS idx_schedule_notifications_session
    ON schedule_notifications (session_id);
