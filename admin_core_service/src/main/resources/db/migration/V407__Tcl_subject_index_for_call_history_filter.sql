-- The leads-list call-history filter (LeadFilterDTO.callHistoryFilter) matches
-- telephony_call_log rows by response_id OR (subject_id + subject_type = 'LEAD').
-- response_id already has idx_tcl_response, but subject_id had no index, so the
-- CALLED_ONCE / CALLED_TWICE_PLUS correlated COUNT sub-queries seq-scanned the
-- whole call log for every candidate lead and the query hit the statement
-- timeout. This index lets those per-lead lookups run as a BitmapOr of two
-- index probes.
CREATE INDEX IF NOT EXISTS idx_tcl_subject
    ON telephony_call_log (subject_id, subject_type)
    WHERE subject_id IS NOT NULL;
