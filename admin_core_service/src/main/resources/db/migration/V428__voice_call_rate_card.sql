-- Per-minute economics of a voice call, as DATA rather than code, so a vendor
-- price change is a row edit and not a deploy — and so historical calls can be
-- recosted against the rate that was actually in force.
--
-- Every figure below is MEASURED, not guessed:
--   plivo        0.60  founder-supplied
--   stt_sarvam   0.40  founder-supplied
--   tts_google   2.06  779 chars/call-minute measured across 13 production
--                      calls x $30/1M chars (Chirp3-HD)
--   tts_sarvam   2.34  same character rate at Sarvam's price
--   tts_rumik    0.45  founder-supplied
--   llm_gemini   0.57  6.17 bot turns/min (133 real calls, 14 days) x 4,569
--                      input + 58 output tokens/turn (Vertex usageMetadata on
--                      the live agent prompt), at $0.30/$2.50 per 1M, with the
--                      38% of input tokens Gemini's implicit cache already
--                      discounts to $0.03/1M. Drops to ~0.19 if we ever wire
--                      EXPLICIT prompt caching.
--   billed       set to your own selling rate; margin is meaningless until it is
--
-- component names match what the API looks up: 'tts_<engine>' where engine is
-- ai_agent.tts_model, so a new engine only needs a row here.
CREATE TABLE IF NOT EXISTS voice_call_rate_card (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    component       VARCHAR(64)  NOT NULL,
    inr_per_min     NUMERIC(10,4) NOT NULL,
    kind            VARCHAR(16)  NOT NULL DEFAULT 'COST',   -- COST | REVENUE
    is_measured     BOOLEAN      NOT NULL DEFAULT false,
    notes           TEXT,
    effective_from  TIMESTAMP    NOT NULL DEFAULT now(),
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_rate_component_active
    ON voice_call_rate_card (component) WHERE is_active;

INSERT INTO voice_call_rate_card (component, inr_per_min, kind, is_measured, notes) VALUES
 ('plivo',        0.6000, 'COST',    false, 'Telephony, per connected minute'),
 ('stt_sarvam',   0.4000, 'COST',    false, 'Sarvam saaras streaming STT'),
 ('tts_google',   2.0600, 'COST',    true,  'Chirp3-HD; 779 chars/call-min measured x $30/1M'),
 ('tts_sarvam',   2.3400, 'COST',    true,  'bulbul; same measured character rate'),
 ('tts_rumik',    0.4500, 'COST',    false, 'Silk Mulberry'),
 ('tts_smallest', 0.0000, 'COST',    false, 'Lightning — rate not yet confirmed against an invoice'),
 ('llm',          0.5700, 'COST',    true,  'gemini-2.5-flash: 6.17 turns/min x 4569 in + 58 out, 38% implicitly cached'),
 ('billed',       0.0000, 'REVENUE', false, 'YOUR selling rate per minute — set this or margin is meaningless')
ON CONFLICT DO NOTHING;
