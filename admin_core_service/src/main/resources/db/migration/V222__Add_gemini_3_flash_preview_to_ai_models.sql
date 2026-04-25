-- V222: Add google/gemini-3-flash-preview as the low-cost model for script and
-- per-shot HTML generation on free / standard / premium video tiers.
-- Pricing (Google AI Studio public rates):
--   input_price_per_1m  = $0.10
--   output_price_per_1m = $0.40

INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free, credit_multiplier,
    max_tokens, context_window, input_price_per_1m, output_price_per_1m,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('google/gemini-3-flash-preview', 'Gemini 3 Flash Preview', 'Google', 'general', 'standard', FALSE, 1.0,
     65536, 1048576, 0.10, 0.40, ARRAY['video', 'content', 'analytics'], 3, 5, 34,
     'Google Gemini 3 Flash preview — low-cost script + per-shot HTML for free/standard/premium video tiers', FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    credit_multiplier = EXCLUDED.credit_multiplier,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
