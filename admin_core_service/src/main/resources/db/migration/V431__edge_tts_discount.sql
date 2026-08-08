-- Edge TTS costs us nothing, so an Edge agent is sold cheaper: founder's price
-- is 2 credits/min for the AI leg and 1 for telephony, against the standard
-- 5 + 1.
--
-- Expressed as a NEGATIVE surcharge (-3) on the AI leg: ai_call_out is 5
-- credits/min, so 5 + (-3) = 2, and the telephony leg stays at 1. Total
-- 3 credits/min instead of 6.
--
-- This required CallBillingService to stop guarding on signum() > 0 — with that
-- guard a discount was silently dropped and the institute paid full rate. The
-- result is floored at zero so a discount can never refund credits.
UPDATE ai_tts_model_pricing
SET surcharge_credits_per_min = -3.0000,
    description = 'Microsoft Edge read-aloud — free to run, so sold cheaper: -3 credits/min off the AI leg, i.e. 2 AI + 1 telephony = 3 credits/min against the standard 6. Five hi-IN/en-IN Neural voices, 0.27s TTFB via streaming MP3 decode. Not offline: it calls Microsoft''s public endpoint.',
    updated_at = now()
WHERE model = 'edge';

-- The Calls report priced Edge with a flat rupee override while this was being
-- settled. Now that billing itself is correct, drop it so the report and the
-- invoice come from the same place.
DELETE FROM voice_call_rate_card WHERE component = 'billed_inr_per_min_edge';
