-- =============================================================================
-- Per-call technical diagnostics for AI voice calls.
--
-- The voice bot already posts a top-level `diagnostics` object on every
-- end-of-call report (voice_bot_service/app/diagnostics.py). Until now it only
-- survived inside raw_payload, so answering "why did this call go wrong?" meant
-- grepping the box — diagnosing three founder-flagged calls in 2026-07 took a
-- sweep of ~140k log lines across 220 calls. This promotes the blob to queryable
-- columns so the same question is a hover in the admin UI.
--
-- Confirmed root causes that blob makes visible: a wedged Sarvam TTS socket
-- (8-10.4s where the caller heard nothing), pipecat's aggregator DELETING caller
-- answers (179 across 40% of calls — the literal words IGCSE, Symbiosis, Monday),
-- replies killed before a single audio byte, and 72% false "Sorry, I missed that".
--
-- ALL THREE COLUMNS ARE NULLABLE ON PURPOSE. Every row already in this table
-- predates the blob, and non-AI/older providers never send one; a NULL here means
-- "not measured", never "healthy". Nothing existing has to be backfilled to keep
-- working.
-- =============================================================================

ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS diagnostics jsonb NULL;
ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS diag_health varchar(8) NULL;
ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS diag_faults text NULL;

COMMENT ON COLUMN ai_call_result.diagnostics IS
    'Verbatim `diagnostics` object from the end-of-call report (rulesVersion, health, faults, tts, playout, turnTaking, latency, setup, machine, infra). NULL = the report carried none. Kept whole so health can be re-derived across history when rulesVersion changes.';
COMMENT ON COLUMN ai_call_result.diag_health IS
    'GREEN / AMBER / RED, derived from diagnostics->>health at ingest. NULL = not measured (never treat as GREEN).';
COMMENT ON COLUMN ai_call_result.diag_faults IS
    'Comma-joined fault codes from diagnostics->faults, e.g. "DEAD_AIR,TTS_WEDGE". Denormalised so fleet queries are a cheap LIKE instead of a jsonb array scan. Closed, append-only vocabulary of 12 codes.';

-- Fleet triage is always "show me the calls that went wrong", so the index only
-- has to cover measured rows; the partial predicate keeps it small on a table
-- where the majority of history has no diagnostics at all.
CREATE INDEX IF NOT EXISTS idx_ai_call_result_diag_health
    ON ai_call_result (diag_health) WHERE diag_health IS NOT NULL;
