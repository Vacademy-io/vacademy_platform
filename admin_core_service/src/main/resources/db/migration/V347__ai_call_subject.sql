-- =============================================================================
-- V347: Make AI calling subject-agnostic.
--
-- Until now every AI (Aavtaar) call targeted a CRM lead (audience_response). The
-- AI-calling node is now a GENERIC component: it calls a "subject" (a lead, an
-- enrolled student, a live-session participant, …), the provider mapping is internal,
-- and it produces structured output. What's DONE with that output is the consumer's
-- job (the workflow's downstream nodes, or a query over the results) — never baked
-- into the node.
--
-- subject_type / subject_id record what a call targeted. LEAD (or NULL) keeps the
-- original lead behaviour as one built-in consumer; other subject types skip the
-- lead actions and just expose their data. The outcome processor reads these to
-- branch. No backfill: legacy rows have NULL subject_type ⇒ treated as LEAD.
-- =============================================================================

ALTER TABLE telephony_call_log
    ADD COLUMN subject_type VARCHAR(32),   -- LEAD | PACKAGE_SESSION_STUDENT | LIVE_SESSION_PARTICIPANT (NULL ⇒ LEAD)
    ADD COLUMN subject_id   VARCHAR(64);   -- domain id: audience_response.id (lead) | package_session_id | participant id
