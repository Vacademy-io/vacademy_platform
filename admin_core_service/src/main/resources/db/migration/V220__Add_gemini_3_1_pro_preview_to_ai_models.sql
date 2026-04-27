-- Register google/gemini-3.1-pro-preview in the ai_models registry.
-- Without this row, both credit_service.py (deduction) and the video pipeline's
-- estimated_cost_usd field fall back to generic token rates, which underbills
-- Gemini 3 Pro by ~50%.
--
-- Pricing reference (Google, ≤200K prompt tokens):
--   input_price_per_1m = $2.00
--   output_price_per_1m = $12.00
-- Long-context surcharge (>200K) is applied in code (automation_pipeline.py).

INSERT INTO ai_models (
    model_id, name, provider, category, tier, is_free, credit_multiplier,
    max_tokens, context_window, input_price_per_1m, output_price_per_1m,
    recommended_for, quality_score, speed_score, display_order, description, is_default_free
)
VALUES
    ('google/gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', 'Google', 'general', 'ultra', FALSE, 4.0,
     1048576, 1048576, 2.0, 12.0, ARRAY['evaluation', 'analytics', 'video'], 5, 4, 33,
     'Google Gemini 3.1 Pro preview — used by Ultra/Super-Ultra video tiers', FALSE)
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    credit_multiplier = EXCLUDED.credit_multiplier,
    updated_at = CURRENT_TIMESTAMP;
