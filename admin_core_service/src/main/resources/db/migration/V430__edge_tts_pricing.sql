-- Microsoft Edge read-aloud as a TTS engine. It is FREE — no key, no
-- per-character charge — so it costs us nothing but the telephony leg, the STT
-- and the LLM. Founder's price for an Edge agent: Rs 2 per minute.
--
-- NOTE ON WHERE THIS APPLIES. voice_call_rate_card drives the super-admin Calls
-- REPORT. The money actually leaving a wallet is computed by CallBillingService
-- from credit_pricing, which prices per REQUEST TYPE and not per engine — so
-- charging Edge agents Rs 2/min for real needs its own decision there. This
-- migration makes the report tell the truth about Edge; it does not silently
-- change what anybody is charged.
INSERT INTO ai_tts_model_pricing (model, surcharge_credits_per_min, description, is_active,
                                  created_at, updated_at)
VALUES ('edge', 0.0000,
        'Microsoft Edge read-aloud — free, no API key. Five hi-IN/en-IN Neural voices. Streaming MP3 decode gives 0.27s TTFB, against Chirp3-HD 0.18s. Not offline: it calls Microsoft''s public endpoint, with no SLA.',
        true, now(), now())
ON CONFLICT (model) DO UPDATE
    SET surcharge_credits_per_min = EXCLUDED.surcharge_credits_per_min,
        description = EXCLUDED.description, is_active = true, updated_at = now();

INSERT INTO voice_call_rate_card (component, inr_per_min, kind, is_measured, notes) VALUES
 ('tts_edge', 0.0000, 'COST', true,
  'Microsoft Edge read-aloud is free — there is no per-character charge to model.'),
 ('billed_inr_per_min_edge', 2.0000, 'REVENUE', false,
  'Founder rate for an Edge agent: Rs 2/min, flat, replacing the credit computation for this engine.')
ON CONFLICT DO NOTHING;
