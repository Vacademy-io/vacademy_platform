-- V467: index the anti-join behind the telephony call-log lookups, and record the
-- module_chapter_mapping indexes that were applied to prod by hand.
--
-- S-01 (NATIVE_QUERY_AUDIT_2026_08.md) -- ai_call_result had no index on call_log_id.
-- TelephonyCallLogRepository.findMostRecentOutboundByPhone() and
-- findOutboundByPhoneNearest() both filter with:
--
--     AND NOT EXISTS (SELECT 1 FROM ai_call_result r WHERE r.call_log_id = t.id)
--
-- With only the primary key on ai_call_result, Postgres re-scans the table for each
-- candidate row instead of building the anti-join once: 72 billion rows read from a
-- table holding fewer than 10,000. Indexing call_log_id lets the anti-join probe the
-- index instead.
--
-- The index is partial. Orphan webhooks -- an ai_call_result arriving before (or
-- without) its telephony_call_log -- legitimately leave call_log_id NULL, and those
-- rows can never satisfy r.call_log_id = t.id. Excluding them keeps the index to the
-- rows the predicate can actually match.
--
-- Plain CREATE INDEX rather than CONCURRENTLY: Flyway runs each migration inside a
-- transaction and CONCURRENTLY cannot run in one. The table is small enough that the
-- brief ACCESS EXCLUSIVE lock is not worth the non-transactional workaround.

CREATE INDEX IF NOT EXISTS idx_acr_call_log_id
    ON ai_call_result (call_log_id)
    WHERE call_log_id IS NOT NULL;

-- S-02 -- module_chapter_mapping had only its primary key while 32 native queries join
-- it on module_id / chapter_id. These two indexes were already created directly against
-- prod; IF NOT EXISTS makes this statement a no-op there while still bringing every
-- other environment (and any rebuilt database) into line. Recording it here so the
-- schema is reproducible from migrations alone.
--
-- The table has no status column, so unlike its sibling mapping tables these need no
-- status <> 'DELETED' predicate.

CREATE INDEX IF NOT EXISTS idx_mcm_module_id
    ON module_chapter_mapping (module_id);

CREATE INDEX IF NOT EXISTS idx_mcm_chapter_id
    ON module_chapter_mapping (chapter_id);
