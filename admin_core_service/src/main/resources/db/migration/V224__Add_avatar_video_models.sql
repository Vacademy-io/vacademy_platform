-- V224: Add per-second priced video models for the new on-screen Host feature.
-- The new column `video_price_per_second` mirrors the existing per-image
-- `image_price_per_unit` column (added in V221) — billing on a different unit
-- than the per-1M-token rates used for LLMs. Used by
-- app/services/video_estimation_service.py:_get_video_second_price().
--
-- Two fal.ai talking-head models are registered:
--   • fal-ai/kling-video/ai-avatar/v2/standard — $0.0562 / sec (default)
--   • veed/fabric-1.0                          — $0.0800 / sec
-- Tier-gated to ultra (and super_ultra) only via API-layer validation in
-- video_generation_service.

ALTER TABLE ai_models
    ADD COLUMN IF NOT EXISTS video_price_per_second NUMERIC(10,6);

COMMENT ON COLUMN ai_models.video_price_per_second IS
    'Per-second USD cost for video models (avatar synthesis, future video gen). NULL for non-video models.';

INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free,
    credit_multiplier, video_price_per_second,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('fal-ai/kling-video/ai-avatar/v2/standard', 'Kling AI Avatar v2 (Standard)',
     'fal.ai', 'video', 'ultra', FALSE,
     1.5, 0.056200,
     ARRAY['avatar', 'video'], 4, 4, 70,
     'Per-shot lip-synced talking-head video via fal.ai Kling v2 Standard. Used by the Host (avatar) feature on ultra/super_ultra tiers.',
     FALSE),
    ('veed/fabric-1.0', 'VEED Fabric 1.0',
     'fal.ai', 'video', 'ultra', FALSE,
     1.5, 0.080000,
     ARRAY['avatar', 'video'], 4, 3, 71,
     'Per-shot lip-synced talking-head video via fal.ai VEED Fabric 1.0. Alternate to Kling on the Host (avatar) feature.',
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
