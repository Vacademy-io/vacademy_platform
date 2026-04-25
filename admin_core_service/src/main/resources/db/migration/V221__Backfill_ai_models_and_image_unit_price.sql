-- Backfill ai_models registry with model IDs referenced in ai_service code that
-- were missing from the V101 seed, and add image_price_per_unit so per-image
-- pricing lives in the DB (single source of truth) rather than as a code constant.

-- 1. New column for per-image cost (USD). NULL for non-image / token-priced models.
ALTER TABLE ai_models
    ADD COLUMN IF NOT EXISTS image_price_per_unit NUMERIC(10, 6) DEFAULT NULL;

COMMENT ON COLUMN ai_models.image_price_per_unit IS
    'Per-image USD cost for image-generation models. NULL for token-priced models.';

-- 2. Backfill the existing image row with its per-unit price (was 0/0 in V101).
UPDATE ai_models
   SET image_price_per_unit = 0.04
 WHERE model_id = 'google/gemini-2.5-flash-image';

-- 3. Insert / upsert the missing models referenced in code.

-- Google variants
INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free, credit_multiplier,
    max_tokens, context_window, input_price_per_1m, output_price_per_1m,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('google/gemini-2.0-flash', 'Gemini 2.0 Flash', 'Google', 'general', 'standard', FALSE, 1.0,
     1048576, 1048576, 0.10, 0.40, ARRAY['content', 'agent', 'copilot'], 4, 5, 11,
     'Gemini 2.0 Flash — paid tier', FALSE),

    ('google/gemini-2.0-flash-lite-001', 'Gemini 2.0 Flash Lite', 'Google', 'general', 'standard', FALSE, 0.7,
     1048576, 1048576, 0.075, 0.30, ARRAY['content', 'copilot'], 3, 5, 12,
     'Lightweight Gemini 2.0 Flash for low-cost workloads', FALSE),

    ('google/gemini-2.5-flash-preview-05-20', 'Gemini 2.5 Flash (Preview 05-20)', 'Google', 'general', 'standard', FALSE, 1.0,
     1048576, 1048576, 0.10, 0.40, ARRAY['content', 'video'], 4, 5, 13,
     'Dated preview snapshot of Gemini 2.5 Flash', FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    credit_multiplier = EXCLUDED.credit_multiplier,
    updated_at = CURRENT_TIMESTAMP;

-- Anthropic variants (4.x — DB previously only had 4.5 / 3.5)
INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free, credit_multiplier,
    max_tokens, context_window, input_price_per_1m, output_price_per_1m,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('anthropic/claude-sonnet-4', 'Claude Sonnet 4', 'Anthropic', 'general', 'premium', FALSE, 2.0,
     200000, 200000, 3.0, 15.0, ARRAY['content', 'evaluation', 'analytics'], 5, 4, 21,
     'Claude Sonnet 4', FALSE),

    ('anthropic/claude-opus-4', 'Claude Opus 4', 'Anthropic', 'general', 'ultra', FALSE, 4.0,
     200000, 200000, 15.0, 75.0, ARRAY['evaluation', 'analytics'], 5, 3, 34,
     'Claude Opus 4', FALSE),

    ('anthropic/claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (2025-10-01)', 'Anthropic', 'general', 'standard', FALSE, 1.0,
     200000, 200000, 1.0, 5.0, ARRAY['content', 'agent', 'highlight'], 4, 5, 14,
     'Claude Haiku 4.5 dated snapshot — used by render-worker highlight extractor', FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    credit_multiplier = EXCLUDED.credit_multiplier,
    updated_at = CURRENT_TIMESTAMP;

-- ByteDance Seedream (image generation via OpenRouter)
INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free, credit_multiplier,
    input_price_per_1m, output_price_per_1m, image_price_per_unit,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('bytedance-seed/seedream-4.5', 'Seedream 4.5', 'ByteDance', 'image', 'standard', FALSE, 1.5,
     0, 0, 0.06, ARRAY['image'], 4, 4, 51,
     'ByteDance Seedream 4.5 — image generation, billed per image', FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    image_price_per_unit = EXCLUDED.image_price_per_unit,
    credit_multiplier = EXCLUDED.credit_multiplier,
    updated_at = CURRENT_TIMESTAMP;
