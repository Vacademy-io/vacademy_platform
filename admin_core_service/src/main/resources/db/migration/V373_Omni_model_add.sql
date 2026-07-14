-- Migration: Register the DIALOGUE_SCENE clip video models in the ai_models
--            registry — Seedance 2.0 (voice-locked lip-sync, the default) and
--            Google Gemini Omni Flash (cheaper, self-voiced) — so admins can
--            see/manage them and the FE can list them as user-selectable
--            options for storybook/drama videos.
-- Date: 2026-07-14
-- Notes:
--  * Both are fal.ai-hosted VIDEO models priced per second of output, not per
--    token. The authoritative per-second rates live in code
--    (fal_seedance_client.py / fal_omni_client.py) and drive the budget cap +
--    credit ledger; the rows here are catalog/visibility. Omni's underlying
--    token prices ARE real ($1.875/M in, $21.875/M out ≈ $0.13/s of 720p), so
--    they're recorded; Seedance has no token pricing (NULL) — see description.
--  * Idempotent: WHERE NOT EXISTS on model_id.

BEGIN;

INSERT INTO ai_models (
    id, model_id, name, provider, category, tier,
    max_tokens, context_window, supports_streaming, supports_images,
    input_price_per_1m, output_price_per_1m, credit_multiplier,
    is_free, recommended_for, quality_score, speed_score,
    description, display_order, created_at, updated_at
)
SELECT
    gen_random_uuid()::text, 'bytedance/seedance-2.0/reference-to-video',
    'Seedance 2.0 (Dialogue Clips)', 'fal', 'video', 'premium',
    NULL, NULL, FALSE, TRUE,
    NULL, NULL, 1.0,
    FALSE, ARRAY['video'], 5, 3,
    'Reference-to-video with AUDIO INPUT: characters lip-sync verbatim to our per-character TTS (@Audio1) — voice-locked across scenes and sequel videos. 4-15s clips. Priced per second of output: $0.135/s 480p, $0.3034/s 720p, $0.682/s 1080p (audio-neutral). Default DIALOGUE_SCENE model.',
    100, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ai_models WHERE model_id = 'bytedance/seedance-2.0/reference-to-video'
);

INSERT INTO ai_models (
    id, model_id, name, provider, category, tier,
    max_tokens, context_window, supports_streaming, supports_images,
    input_price_per_1m, output_price_per_1m, credit_multiplier,
    is_free, recommended_for, quality_score, speed_score,
    description, display_order, created_at, updated_at
)
SELECT
    gen_random_uuid()::text, 'google/gemini-omni-flash/reference-to-video',
    'Gemini Omni Flash (Dialogue Clips)', 'fal', 'video', 'standard',
    NULL, NULL, FALSE, TRUE,
    1.875, 21.875, 1.0,
    FALSE, ARRAY['video'], 4, 4,
    'Reference-to-video, SELF-VOICED: no audio input — the model speaks the dialogue lines itself (no TTS voice lock; voices may drift between scenes). 3-10s clips, <IMAGE_REF_n> reference binding. Effective rate ~$0.13/s of 720p output (~2.3x cheaper than Seedance).',
    101, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ai_models WHERE model_id = 'google/gemini-omni-flash/reference-to-video'
);

COMMIT;
