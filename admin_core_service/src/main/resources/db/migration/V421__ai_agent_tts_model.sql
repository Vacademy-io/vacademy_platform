-- Per-agent TTS engine, and the credit surcharge that goes with it.
--
-- Rumik Silk Mulberry 1.5 costs Rs 0.50/1k characters against Sarvam bulbul:v3's
-- Rs 3.00. TTS is ~65% of an AI call's marginal cost, so the choice of engine is
-- the single biggest lever on margin — which means it has to be a priced product
-- option, not a hidden config flag.

ALTER TABLE ai_agent ADD COLUMN IF NOT EXISTS tts_model VARCHAR(32);

-- Existing agents are pinned to 'sarvam' EXPLICITLY rather than left NULL.
--
-- These institutes approved a Sarvam voice and are billed against it, so they
-- must keep it: silently moving a paying customer onto a different-sounding
-- engine is a product change, not a config change. Writing the value down (as
-- opposed to relying on "NULL means sarvam" semantics) means the admin UI shows
-- them the truth, the billing lookup resolves without a special case, and nobody
-- has to rediscover the convention six months from now.
--
-- NEW agents get 'rumik' stamped by AiAgentService on create. Deliberately NOT a
-- column DEFAULT: a DB default would silently decide pricing for any future
-- insert path that forgets the field, and that decision belongs in code where it
-- is reviewable and testable.
UPDATE ai_agent SET tts_model = 'sarvam' WHERE tts_model IS NULL;

-- Per-engine surcharge on top of the base ai_call_out / ai_call_in rate.
--
-- Modelled as a surcharge rather than as separate request_types because the
-- request_type is what the customer-facing ledger groups by, and splitting
-- 'ai_call_out' into per-vendor types would fragment every existing institute's
-- usage history and break the per-institute billing overrides that key off it.
CREATE TABLE IF NOT EXISTS ai_tts_model_pricing (
    model                      VARCHAR(32) PRIMARY KEY,
    surcharge_credits_per_min  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    description                TEXT,
    is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMP DEFAULT now(),
    updated_at                 TIMESTAMP DEFAULT now()
);

-- Base rate (credit_pricing.ai_call_out = 5.0 credits/min, + voice_call_out 1.0
-- for the telephony leg = 6.0 all-in) is priced for Rumik, so Rumik surcharges 0.
-- Sarvam adds 4.0 credits/min => 10.0 all-in.
--
-- Silk Muga 1 is deliberately absent: not wired in the bot, and an inactive row
-- here would resolve to a 0 surcharge, i.e. we would serve the expensive model at
-- the cheap price. Absent means unsellable, which is the correct state for now.
INSERT INTO ai_tts_model_pricing (model, surcharge_credits_per_min, description, is_active)
VALUES
    ('rumik',  0.0, 'Rumik Silk Mulberry 1.5 (default) — Rs 0.50/1k chars; base ai_call rate already covers it', TRUE),
    ('sarvam', 4.0, 'Sarvam bulbul:v3 — Rs 3.00/1k chars, 6x Rumik on the dominant cost line; +4 credits/min', TRUE)
ON CONFLICT (model) DO UPDATE
    SET surcharge_credits_per_min = EXCLUDED.surcharge_credits_per_min,
        description               = EXCLUDED.description,
        is_active                 = EXCLUDED.is_active,
        updated_at                = now();

-- Resolved per call from ai_call_result.campaign_id -> ai_agent.id, so the index
-- that matters is the PK above; this one keeps the admin agent list cheap when
-- filtering by engine (e.g. "who is still on Sarvam?").
CREATE INDEX IF NOT EXISTS idx_ai_agent_tts_model ON ai_agent (tts_model);
