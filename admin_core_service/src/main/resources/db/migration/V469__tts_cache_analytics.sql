-- TTS speech-cache analytics: the voice bot's ledger, mirrored into Postgres.
--
-- WHY MIRROR RATHER THAN PROXY. The cache is SQLite plus PCM files on the Mumbai
-- box's local disk. Serving the analytics tab by proxying that would mean: every
-- request crosses to another machine, the tab dies when the bot restarts, nothing
-- can be joined to ai_agent for real names or filtered by institute in SQL, and —
-- worst — there is no HISTORY. The ledger is a current-state snapshot; it can say
-- what is cached right now but never what the hit rate was last Tuesday.
--
-- WHY THE BOT PUSHES. The bot already authenticates TO admin-core (it fetches
-- call-context and posts every end-of-call report through InternalAuthFilter).
-- That direction works and needs no new credential. The reverse direction has
-- none, which is why warm-on-save has never once fired in production. Pushing
-- uses the path that already works.
--
-- This is the same shape as call_intelligence (V345): a table that is both the
-- store and the queue, with a poller on the other side.

-- ── What the cache holds, per agent ─────────────────────────────────────────
--
-- The cache KEY is global on purpose — (engine, model, voice, pace, temperature,
-- rate, text) and no institute — so two agents on the same voice saying the same
-- sentence share one rendered blob. That is worth keeping, so attribution is a
-- separate dimension rather than a change to the key: one row per (key, agent),
-- and the blob columns simply repeat. Asking "what has THIS agent cached" then
-- costs one index lookup, and flushing one agent cannot silently flush another.
CREATE TABLE IF NOT EXISTS tts_cache_entry (
    cache_key     VARCHAR(64)  NOT NULL,
    agent_id      VARCHAR(64)  NOT NULL,
    institute_id  VARCHAR(64),
    engine        VARCHAR(32),
    model         VARCHAR(64),
    voice         VARCHAR(64),
    -- The sentence itself. Needed by the entries screen, and it is the only way
    -- to spot the near-duplicate pairs that split a hit in two.
    sentence      TEXT,
    chars         INTEGER      NOT NULL DEFAULT 0,
    -- A bot-authored line (opening, farewell, handback, filler) rather than
    -- something the LLM produced. They answer to different admission rules, so
    -- the screens must be able to tell them apart.
    is_fixed      BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Times this agent spoke it, and times it was served from cache.
    sightings     INTEGER      NOT NULL DEFAULT 0,
    hits          INTEGER      NOT NULL DEFAULT 0,
    -- FALSE = in the ledger but no audio yet: still below the render threshold.
    -- This is exactly the "misses" screen — what is not cached, and why.
    rendered      BOOLEAN      NOT NULL DEFAULT FALSE,
    bytes         INTEGER,
    duration_ms   INTEGER,
    first_seen_at TIMESTAMP,
    last_seen_at  TIMESTAMP,
    last_hit_at   TIMESTAMP,
    -- When the bot last told us about this row. A row that stops being reported
    -- has been evicted or the volume was reset; the screens can grey it out
    -- rather than pretend it is still on disk.
    reported_at   TIMESTAMP    NOT NULL DEFAULT now(),
    PRIMARY KEY (cache_key, agent_id)
);

-- The tab landing groups by agent; the entries screen sorts an agent's rows by
-- value. One index serves both.
CREATE INDEX IF NOT EXISTS idx_tts_cache_entry_agent
    ON tts_cache_entry (agent_id, hits DESC);

-- "What is costing us?" — the not-yet-rendered rows, biggest first. Partial,
-- because once a sentence renders it leaves this question behind.
CREATE INDEX IF NOT EXISTS idx_tts_cache_entry_unrendered
    ON tts_cache_entry (agent_id, chars DESC) WHERE NOT rendered;

CREATE INDEX IF NOT EXISTS idx_tts_cache_entry_institute
    ON tts_cache_entry (institute_id);

-- ── Commands going the other way ────────────────────────────────────────────
--
-- Reads are a mirror, but a flush is an ACTION on files that live on the bot's
-- disk, so something has to travel back. Rather than open an admin-core -> bot
-- channel (which is what has no credential), admin-core writes a row here and
-- the bot claims it on its next cycle — the call_intelligence pattern, reused.
--
-- The cost is honest: a flush is asynchronous, seconds not instant, and the UI
-- must say "queued" rather than "done".
CREATE TABLE IF NOT EXISTS tts_cache_command (
    id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    -- FLUSH_AGENT (every entry for one agent) | DELETE_ENTRY (one cache_key)
    kind          VARCHAR(24)  NOT NULL,
    agent_id      VARCHAR(64),
    cache_key     VARCHAR(64),
    -- A dry run reports what WOULD go and deletes nothing. The default, because
    -- the destructive reading of an ambiguous request is the wrong one.
    dry_run       BOOLEAN      NOT NULL DEFAULT TRUE,
    -- PENDING -> CLAIMED -> DONE | FAILED
    status        VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    requested_by  VARCHAR(64),
    -- What actually happened: how many entries and bytes went, or the error.
    -- This is the flush log; a destructive action with no record is not one
    -- anybody should be able to run from a web page.
    result        TEXT,
    entries_removed INTEGER,
    bytes_removed   BIGINT,
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    claimed_at    TIMESTAMP,
    finished_at   TIMESTAMP
);

-- The poller asks one question: what is PENDING, oldest first. Partial, because
-- finished commands are history and must not slow the claim.
CREATE INDEX IF NOT EXISTS idx_tts_cache_command_pending
    ON tts_cache_command (created_at) WHERE status = 'PENDING';

ALTER TABLE tts_cache_command DROP CONSTRAINT IF EXISTS ck_tts_cache_command_kind;
ALTER TABLE tts_cache_command ADD CONSTRAINT ck_tts_cache_command_kind
    CHECK (kind IN ('FLUSH_AGENT', 'DELETE_ENTRY'));

ALTER TABLE tts_cache_command DROP CONSTRAINT IF EXISTS ck_tts_cache_command_status;
ALTER TABLE tts_cache_command ADD CONSTRAINT ck_tts_cache_command_status
    CHECK (status IN ('PENDING', 'CLAIMED', 'DONE', 'FAILED'));
