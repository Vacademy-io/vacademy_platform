-- Smallest.ai Lightning v3.1 Pro as a selectable engine.
--
-- A SEPARATE engine id from `smallest`, not a variant. The two voice palettes are
-- disjoint and the vendor hard-rejects a cross-model name ("Voice 'devansh' is not
-- available on the lightning_v3.1_pro model") — which on a live call is silence.
-- Keeping them distinct is what stops the picker from making that reachable.
--
-- COST: $0.195 per 10K characters (smallest.ai/pricing/models, read 2026-08-20)
-- = $19.50/1M. At our measured 779 chars/call-min and the Rs 88.15/USD implied by
-- the existing tts_google row, that is ~Rs 1.34/call-min, against standard v3.1's
-- ~Rs 1.20. Both sit well under Google's Rs 2.06, which already carries a zero
-- surcharge — so Pro carries none either and the all-in stays 6 credits/min.

INSERT INTO ai_tts_model_pricing (model, surcharge_credits_per_min, description, is_active)
VALUES (
    'smallest_pro',
    0.0000,
    'Smallest.ai Lightning v3.1 Pro — $19.50/1M chars (~Rs 1.34/call-min), cheaper '
    'than Google Chirp3-HD, so no surcharge: it fits the base ai_call rate. Voice '
    'palette is DISJOINT from lightning_v3.1; a cross-model voice is rejected outright.',
    TRUE
)
ON CONFLICT (model) DO UPDATE
    SET surcharge_credits_per_min = EXCLUDED.surcharge_credits_per_min,
        description               = EXCLUDED.description,
        is_active                 = EXCLUDED.is_active;

-- Vendor-cost side of the margin report (SuperAdminCallService looks up
-- "tts_" || tts_model, so this component name must match the engine id exactly).
--
-- NOTE the conflict target. voice_call_rate_card's unique index is PARTIAL:
--   uq_voice_rate_component_active UNIQUE btree (component) WHERE is_active
-- so a bare ON CONFLICT (component) fails with 42P10 "no unique or exclusion
-- constraint matching the ON CONFLICT specification" — the predicate has to be
-- repeated for Postgres to match the index. (ai_tts_model_pricing above is a
-- plain PK on model, which is why it needs no predicate.)
INSERT INTO voice_call_rate_card (component, inr_per_min, is_active)
VALUES ('tts_smallest_pro', 1.3400, TRUE)
ON CONFLICT (component) WHERE is_active DO UPDATE
    SET inr_per_min = EXCLUDED.inr_per_min;

-- Standard Lightning v3.1 was seeded at 0.00 when the engine was added, so 147
-- calls / 282.6 minutes of real TTS cost (~Rs 339) were booked as free and every
-- Smallest call's margin was overstated by ~18 points. $17.50/1M chars at our
-- measured 779 chars/call-min and the Rs 88.15/USD implied by tts_google = Rs 1.20.
-- Applied to prod by hand on 2026-08-20; carried here so every other environment
-- and any rebuild gets it too.
INSERT INTO voice_call_rate_card (component, inr_per_min, is_active)
VALUES ('tts_smallest', 1.2000, TRUE)
ON CONFLICT (component) WHERE is_active DO UPDATE
    SET inr_per_min = EXCLUDED.inr_per_min;

-- Deepgram shipped in V451 with a surcharge row but NO cost component, so every
-- Deepgram call books its TTS at zero and overstates margin — the same gap that
-- hid Rs 339 of Smallest cost. $30/1M chars, identical to Chirp3-HD, so it takes
-- the same Rs 2.06/call-min at our measured 779 chars/call-min.
INSERT INTO voice_call_rate_card (component, inr_per_min, is_active)
VALUES ('tts_deepgram', 2.0600, TRUE)
ON CONFLICT (component) WHERE is_active DO UPDATE
    SET inr_per_min = EXCLUDED.inr_per_min;
