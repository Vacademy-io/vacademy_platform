-- =============================================================================
-- Call sentiment + measured caller engagement on AI voice calls.
--
-- TWO SEPARATE JOBS, deliberately in one migration because the voice bot starts
-- emitting both in the same release.
--
-- 1. SENTIMENT (call_quality, call_gist) — a one-line verdict on HOW THE CALL
--    WENT, shown next to the disposition in the admin UI. It grades OUR AGENT,
--    not the lead: lead_rating already scores the lead's interest, and
--    diag_health (V416) already scores the audio pipeline but is blind to whether
--    the conversation actually worked — every fabricated disposition found in the
--    2026-09-09 audit sat on a diag_health=GREEN call with no faults at all.
--    Not analytics; one sentence a human can skim.
--
-- 2. ENGAGEMENT (caller_word_count) — how many words the caller actually said.
--    A MEASURED number, not a model judgement, and that is the whole point: the
--    outcome classifier now routes an "engaged but unjudged" call to a human off
--    this column instead of off the disposition string. The same audit found a
--    428-second call in which the caller said 433 words land on Incomplete_Call,
--    and a 196-second engaged call land on Incomplete and go to RETRY — i.e.
--    re-dial someone who had just held a three-minute conversation. Routing on a
--    fact rather than on the label fixes that without trusting the classifier we
--    had just caught inventing things.
--
-- ALL THREE COLUMNS ARE NULLABLE. Every existing row predates the fields, and
-- non-AI providers never send them. For call_quality a NULL means NOT ASSESSED —
-- never render it as GOOD, exactly the contract V416 set for diag_health. For
-- caller_word_count a NULL means NOT MEASURED, which is NOT the same as 0 (a
-- genuine silent pickup); the classifier must treat null as "unknown, do not
-- change routing" so untouched history keeps its current behaviour.
-- =============================================================================

ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS call_quality      varchar(16) NULL;
ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS call_gist         varchar(200) NULL;
ALTER TABLE ai_call_result ADD COLUMN IF NOT EXISTS caller_word_count integer      NULL;

COMMENT ON COLUMN ai_call_result.call_quality IS
    'GOOD / NEEDS_WORK / POOR — how well OUR assistant handled the call (not the lead''s interest, which is lead_rating). NULL = not assessed; never treat as GOOD. Closed vocabulary, drives a colour chip in the admin UI.';
COMMENT ON COLUMN ai_call_result.call_gist IS
    'One short sentence on how the call went, naming the single thing most needing improvement, e.g. "Good call - she agreed to a demo, but the bot cut her off twice.". Capped at 180 chars by the bot. NULL = not assessed.';
COMMENT ON COLUMN ai_call_result.caller_word_count IS
    'Words the caller actually contributed, measured from the transcript (synthetic bracketed cues excluded). Drives the classifier''s engaged-but-unjudged -> assign-to-human branch. NULL = not measured (pre-existing rows), which is NOT 0.';

-- Coaching view: "show me the calls that went badly". Partial, because the vast
-- majority of history has no assessment at all and indexing nulls would only
-- bloat it — the same shape as idx_ai_call_result_diag_health.
CREATE INDEX IF NOT EXISTS idx_ai_call_result_call_quality
    ON ai_call_result (institute_id, call_quality, received_at DESC)
    WHERE call_quality IS NOT NULL;
