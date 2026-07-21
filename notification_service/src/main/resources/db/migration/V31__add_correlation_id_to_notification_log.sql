-- V31: correlation_id on notification_log — the Engagement Engine ledger key (Phase 0).
--
-- Why a NEW column and not source_id: source_id already carries the provider message id
-- (WhatsApp wamid for status-webhook joins, JavaMail Message-ID for inbound-email reply
-- linking). A caller-supplied correlation key (engagement_action.id) is a second, distinct
-- contract; overloading source_id would break one join or the other.
--
-- Deliberately NO unique index here. notification_log is an observation log written AFTER the
-- provider send inside swallowed-exception blocks — a uniqueness violation at that point would
-- dedupe ROWS (destroying sibling ledger rows in the same saveAll) without preventing a
-- duplicate MESSAGE. At-most-once is enforced where it belongs: the engine dispatcher's
-- engagement_action status claim (PENDING→DISPATCHING) before the send, plus reconciliation
-- reads on this index afterwards.
--
-- DEPLOY NOTE: the index build takes a SHARE lock on the service's highest-write table (the
-- predicate matches zero rows today, but the scan still reads the table). Deploy off-peak.
-- Mirror this migration into the devops-baseline set (V30/APP_OVERLAY precedent).

ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

-- Lookup: "did action X land / get delivered / get read?" — dispatcher reconciliation and
-- ledger reads join on this after the status webhooks copy the key onto their rows.
CREATE INDEX IF NOT EXISTS idx_nl_correlation
    ON notification_log (correlation_id)
    WHERE correlation_id IS NOT NULL;
