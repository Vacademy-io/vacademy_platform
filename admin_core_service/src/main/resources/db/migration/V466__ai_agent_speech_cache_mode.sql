-- Per-agent control of the TTS speech cache.
--
-- The cache replays audio already paid for when the SAME sentence is spoken again
-- in the same voice (docs/crm/TTS_SPEECH_CACHE.md). TTS is ~65% of an AI call's
-- marginal cost (see V421), so this is a margin lever — but it changes what a
-- caller HEARS, and rollout therefore has to be per agent, not per box.
--
-- WHY A COLUMN AND NOT AN ENV VAR. The voice bot's env switches are process-wide:
-- one flip turns the cache on for every agent taking calls on that box. Rolling
-- out to a single agent, watching a batch, then widening is the shape this needs,
-- and that belongs where the agent is configured — reviewable, no ssh, no
-- container restart, and visible to whoever later asks "why does this agent sound
-- different from that one".
--
-- The env switches remain, demoted to KILL switches: ops can stop the feature
-- box-wide in one restart without touching any institute's configuration.
--
--   OFF   the agent never uses the cache. THE DEFAULT, for every existing row and
--         every new one.
--   FIXED only the bot's own authored lines — the scripted opening, farewells,
--         handbacks, fillers. Each is a standalone utterance with no join to
--         another sentence, which is why this tier is safe on every TTS engine.
--   FULL  the above plus the LLM's own sentences.
--
-- WHY THREE STATES AND NOT A BOOLEAN. FIXED and FULL are not degrees of the same
-- thing, they carry different risk. A cached sentence and a live one can sit next
-- to each other inside one LLM turn, and Sarvam's temperature makes bulbul
-- non-deterministic, so those two are different performances of the same words —
-- the risk is an audible seam at the join, and clearing it needs a per-engine
-- listening test (TTS_SPEECH_CACHE.md §11). FIXED has no such join to test: every
-- line it serves is a whole standalone utterance.
--
-- Collapsed to a boolean, "on" would have to mean one of them. Mean FULL and
-- every enable carries the seam risk with no safe first step; mean FIXED and
-- there is no way to ever reach the part where the money is. The third state IS
-- the rollout ladder, so it earns its keep.
--
-- NULLABLE ON PURPOSE, despite the default. A NOT NULL column would only be
-- protected by the DEFAULT when the INSERT omits it — and Hibernate names every
-- mapped column in its INSERT, so any path that builds an AiAgent without setting
-- this field (the entity carries @Builder) would send an explicit NULL and fail
-- the constraint. Creating an agent is not something to break for a cache. Every
-- reader already treats NULL as OFF: mode_allows() in the bot, the call-context
-- serializer, AiAgentService.normalizeSpeechCacheMode, and AiAgentSpeechWarmer.
--
-- The DEFAULT still does the work that matters: ADD COLUMN backfills every
-- existing row to 'OFF', so nobody's agent changes behaviour on deploy.
ALTER TABLE ai_agent
    ADD COLUMN IF NOT EXISTS speech_cache_mode VARCHAR(16) DEFAULT 'OFF';

-- Guards a typo in a hand-written UPDATE from becoming a silent OFF at runtime.
-- NULL is allowed for the reason above; it reads as OFF everywhere.
ALTER TABLE ai_agent DROP CONSTRAINT IF EXISTS ck_ai_agent_speech_cache_mode;
ALTER TABLE ai_agent ADD CONSTRAINT ck_ai_agent_speech_cache_mode
    CHECK (speech_cache_mode IS NULL OR speech_cache_mode IN ('OFF', 'FIXED', 'FULL'));

-- The rollout question is "which agents have this on?", asked of a small table.
-- Partial: OFF (and NULL) is the overwhelming majority and indexing it would be
-- dead weight. NULL is excluded automatically — NULL <> 'OFF' is NULL, not true —
-- but say so, because a reader should not have to recall three-valued logic to
-- know what this index covers.
CREATE INDEX IF NOT EXISTS idx_ai_agent_speech_cache_on
    ON ai_agent (institute_id)
    WHERE speech_cache_mode IS NOT NULL AND speech_cache_mode <> 'OFF';
