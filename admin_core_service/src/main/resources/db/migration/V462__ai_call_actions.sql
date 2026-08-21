-- AI call actions: the agent promises a WhatsApp/email send or a meeting on the call,
-- and we actually deliver it. See docs/crm/AI_CALL_ACTIONS.md.
--
-- Two additive columns, no behaviour change until an agent is given rules.

-- 1. The rules themselves live on the agent, next to the dispositions and extraction
--    questions they are keyed off. JSON array; NULL/blank = this agent sends nothing,
--    which is every agent that exists today.
--
--    [{"id":"r1","when":{"promised":"scholarship_quiz"},"actionType":"SHARE_LINK",
--      "channel":"WHATSAPP","template":"sn_scholarship_quiz_v1","to":"phone",
--      "timing":"POST_CALL","artefact":"scholarship_quiz"}]
ALTER TABLE ai_agent ADD COLUMN IF NOT EXISTS send_rules TEXT;

-- 2. Provenance + idempotency on the engagement ledger.
--
--    We reuse engagement_action rather than building a parallel sender: it already
--    carries at-most-once dispatch (the PENDING/OPEN -> DISPATCHING claim), Meta
--    fixed-template enforcement, per-message credit billing, the failure inbox, and
--    the id -> notification_log.correlation_id join that answers "did this parent
--    actually receive the quiz link?".
--
--    source     = who created the row. NULL for every existing row (the engine).
--                 'AI_CALL' for rows a call produced.
--    source_ref = the natural key of the thing that caused it, '<call_log_id>:<rule_id>'.
--
--    The partial unique index is the idempotency guard. A re-delivered webhook, a
--    replayed spooled report, or a reconciliation pass MUST NOT send the brochure
--    twice; the insert simply loses the race and is swallowed. Partial (WHERE
--    source_ref IS NOT NULL) so the millions of engine-authored rows are not indexed.
ALTER TABLE engagement_action ADD COLUMN IF NOT EXISTS source     VARCHAR(30);
ALTER TABLE engagement_action ADD COLUMN IF NOT EXISTS source_ref VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ea_source_ref
    ON engagement_action (source, source_ref)
    WHERE source_ref IS NOT NULL;

-- Lookup for the call-detail panel: "what did this call trigger?"
CREATE INDEX IF NOT EXISTS idx_ea_source
    ON engagement_action (source, created_at DESC)
    WHERE source IS NOT NULL;
