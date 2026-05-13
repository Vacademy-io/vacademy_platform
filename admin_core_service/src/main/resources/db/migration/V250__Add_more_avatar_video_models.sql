-- V250: Register three additional fal.ai talking-head models alongside the
-- two seeded in V224. Without a row here, video_estimation_service's
-- _get_video_second_price() returns NULL for the model and the host cost
-- line is silently dropped from the user's price preview — they pick the
-- model from the UI but never see what it actually costs.
--
-- New models (per https://fal.ai/models/<id>/llms.txt):
--   • fal-ai/flashtalk                          — $0.0200 / sec (fastest/cheapest, fixed 768x448)
--   • fal-ai/heygen/avatar4/image-to-video      — $0.1000 / sec (supports aspect ratio, multi-resolution)
--   • fal-ai/kling-video/ai-avatar/v2/pro       — $0.1150 / sec (highest fidelity)
--
-- Existing Host-feature gating (tier='ultra', tier-gated at API layer) is
-- preserved. display_order continues V224's 70-series cluster.

INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free,
    credit_multiplier, video_price_per_second,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('fal-ai/flashtalk', 'FlashTalk',
     'fal.ai', 'video', 'ultra', FALSE,
     1.5, 0.020000,
     ARRAY['avatar', 'video'], 2, 5, 72,
     'Per-shot lip-synced talking-head via fal.ai FlashTalk. Fastest and cheapest option; fixed 768x448 output. Used by the Host (avatar) feature on ultra/super_ultra tiers.',
     FALSE),
    ('fal-ai/heygen/avatar4/image-to-video', 'HeyGen Avatar 4',
     'fal.ai', 'video', 'ultra', FALSE,
     1.5, 0.100000,
     ARRAY['avatar', 'video'], 4, 3, 73,
     'Per-shot lip-synced talking-head via fal.ai HeyGen Avatar 4. Supports 16:9 / 9:16 / 1:1 aspect ratios and 360p-1080p resolutions. Used by the Host (avatar) feature on ultra/super_ultra tiers.',
     FALSE),
    ('fal-ai/kling-video/ai-avatar/v2/pro', 'Kling AI Avatar v2 (Pro)',
     'fal.ai', 'video', 'ultra', FALSE,
     1.5, 0.115000,
     ARRAY['avatar', 'video'], 5, 2, 74,
     'Per-shot lip-synced talking-head via fal.ai Kling v2 Pro. Highest fidelity of the avatar models; slower per-shot render. Used by the Host (avatar) feature on ultra/super_ultra tiers.',
     FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    provider = EXCLUDED.provider,
    category = EXCLUDED.category,
    tier = EXCLUDED.tier,
    credit_multiplier = EXCLUDED.credit_multiplier,
    video_price_per_second = EXCLUDED.video_price_per_second,
    recommended_for = EXCLUDED.recommended_for,
    quality_score = EXCLUDED.quality_score,
    speed_score = EXCLUDED.speed_score,
    display_order = EXCLUDED.display_order,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
