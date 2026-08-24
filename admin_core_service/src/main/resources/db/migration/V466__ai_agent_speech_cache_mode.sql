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
-- and that belongs where the agent is configured — reviewable in the UI, no ssh,
-- no container restart, and visible to whoever later asks "why does this agent
-- sound different from that one".
--
-- The env switches remain, demoted to KILL switches: ops can stop the feature
-- box-wide in one restart without touching any institute's configuration.
--
--   OFF   the agent never uses the cache. THE DEFAULT, for every existing row.
--   FIXED only the bot's own authored lines — the scripted opening, farewells,
--         handbacks, fillers. Each is a standalone utterance with no join to
--         another sentence, which is why this tier is safe on every TTS engine.
--   FULL  the above plus the LLM's own sentences. Requires the per-engine
--         render-parity check first (TTS_SPEECH_CACHE.md §11): cached audio comes
--         from the one-shot HTTP path and live audio from the streaming path, and
--         Sarvam's temperature makes bulbul non-deterministic, so a cached and a
--         live sentence inside one turn are two different performances. The words
--         are never wrong; an audible seam at the join can be.
--
-- Deliberately NOT a column DEFAULT of anything but OFF: a default that enabled
-- caching would silently change how existing agents sound on the next deploy,
-- which is a product change wearing a config change's clothes.
ALTER TABLE ai_agent
    ADD COLUMN IF NOT EXISTS speech_cache_mode VARCHAR(16) NOT NULL DEFAULT 'OFF';

-- Existing agents are pinned explicitly rather than left to the default, for the
-- same reason V421 wrote 'sarvam' into every tts_model instead of relying on
-- "NULL means sarvam": the admin UI should show the truth, and nobody should have
-- to rediscover the convention six months from now.
UPDATE ai_agent SET speech_cache_mode = 'OFF' WHERE speech_cache_mode IS NULL;

-- Guards a typo in a hand-written UPDATE from becoming a silent OFF at runtime.
ALTER TABLE ai_agent DROP CONSTRAINT IF EXISTS ck_ai_agent_speech_cache_mode;
ALTER TABLE ai_agent ADD CONSTRAINT ck_ai_agent_speech_cache_mode
    CHECK (speech_cache_mode IN ('OFF', 'FIXED', 'FULL'));

-- The rollout question is "which agents have this on?", asked of a small table
-- while it is a handful of rows. Partial: OFF is the overwhelming majority and
-- indexing it would be dead weight.
CREATE INDEX IF NOT EXISTS idx_ai_agent_speech_cache_on
    ON ai_agent (institute_id) WHERE speech_cache_mode <> 'OFF';
