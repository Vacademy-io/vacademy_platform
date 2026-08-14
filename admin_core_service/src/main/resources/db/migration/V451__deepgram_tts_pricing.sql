-- Deepgram Aura-2 as a selectable TTS engine.
--
-- PRICE: $0.030 per 1,000 characters (deepgram.com/pricing, read 2026-08-13) =
-- $30/1M chars — the SAME rate as Google Chirp3-HD, so at our measured 779
-- characters per call-minute it lands at ~Rs 2.06/call-min and fits inside the
-- base ai_call rate exactly as `google` does. Hence surcharge 0, and the
-- all-in price stays 6 credits/min (1 voice + 5 AI).
--
-- Note Aura-1 is half that ($0.015/1k) if cost ever matters more than quality;
-- only Aura-2 voices are exposed in TtsVoiceCatalog today.
--
-- ⚠️ ENGLISH ONLY. Verified against Deepgram's live /v1/models catalog on
-- 2026-08-13: 102 TTS models spanning en/es/de/fr/nl/it/ja and NO Hindi at any
-- tier, with none announced. This engine must never be set on a Hinglish agent
-- — the voice would read Devanagari as English letters. The billing row exists
-- so that if someone does select it, the meter is already correct.

INSERT INTO ai_tts_model_pricing (model, surcharge_credits_per_min, description, is_active)
VALUES (
    'deepgram',
    0.0000,
    'Deepgram Aura-2 — $30/1M chars, same rate as Google Chirp3-HD (~Rs 2.06/call-min '
    'at our measured 779 chars/call-min), so no surcharge: it fits the base ai_call rate. '
    'ENGLISH ONLY (en/es/de/fr/nl/it/ja — no Hindi at any tier), American accent, native '
    'streaming websocket. Do not select for a Hinglish agent.',
    TRUE
)
ON CONFLICT (model) DO UPDATE
    SET surcharge_credits_per_min = EXCLUDED.surcharge_credits_per_min,
        description               = EXCLUDED.description,
        is_active                 = EXCLUDED.is_active;
