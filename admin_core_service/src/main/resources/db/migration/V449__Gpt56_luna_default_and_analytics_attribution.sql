-- V449: Move the text use cases onto openai/gpt-5.6-luna, shrink the analytics
-- fallback chain, and repair the model pricing rows that silently under-reported cost.
--
-- Background (prod, 2026-08-12): the hourly student-analytics job burned ~$10 of
-- OpenRouter credit in 3 hours and drained the account to $9.92, because
--   (a) the analytics fallback chain led with anthropic/claude-opus-4.5 and
--       anthropic/claude-opus-4 ($15/$75 per 1M) — 13 models deep, 3 attempts each,
--       so ONE activity log could fire up to 42 billed requests;
--   (b) google/gemini-3-pro-preview does not exist on OpenRouter and 404'd on every
--       single attempt, burning 3 attempts per log for nothing;
--   (c) anthropic/claude-sonnet-4.5 and google/gemini-2.5-flash had no ai_models row
--       at all, so their spend priced as NULL and never showed up in cost reporting.
--
-- The chain is shortened here rather than merely re-ordered: AIModelRegistryService
-- orders by (quality_score DESC, speed_score DESC, display_order ASC), every analytics
-- model scores quality 5, and five of them tie on (5,3,31) — so the walk order is not
-- deterministic. Removing 'analytics' from the expensive models is the only ordering-
-- independent way to guarantee they are never reached.

-- ---------------------------------------------------------------------------
-- 1. Register openai/gpt-5.6-luna
--    $0.10/1M in, $0.60/1M out, 1.05M context, 128K max completion.
--    Verified against the OpenRouter model catalogue: supports response_format,
--    structured_outputs, tools and image input, so it covers every text use case
--    below (all of which send response_format=json_object).
-- ---------------------------------------------------------------------------
INSERT INTO ai_models (
    model_id, name, provider, category, tier,
    max_tokens, context_window,
    supports_streaming, supports_images, supports_function_calling, supports_json_mode,
    input_price_per_1m, output_price_per_1m, credit_multiplier, is_free,
    recommended_for, quality_score, speed_score, is_active, display_order, description
) VALUES (
    'openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'OpenAI', 'general', 'standard',
    128000, 1050000,
    TRUE, TRUE, TRUE, TRUE,
    0.100000, 0.600000, 1.00, FALSE,
    ARRAY['analytics','content','outline','copilot','agent','evaluation',
          'questions','translation','knowledge_base_summary','knowledge_base_qa','lecture'],
    5, 5, TRUE, 1,
    'Primary text model. $0.10/$0.60 per 1M with a 1.05M context window - cheaper than every model it replaces.'
)
ON CONFLICT (model_id) DO UPDATE SET
    name                      = EXCLUDED.name,
    provider                  = EXCLUDED.provider,
    max_tokens                = EXCLUDED.max_tokens,
    context_window            = EXCLUDED.context_window,
    supports_streaming        = EXCLUDED.supports_streaming,
    supports_images           = EXCLUDED.supports_images,
    supports_function_calling = EXCLUDED.supports_function_calling,
    supports_json_mode        = EXCLUDED.supports_json_mode,
    input_price_per_1m        = EXCLUDED.input_price_per_1m,
    output_price_per_1m       = EXCLUDED.output_price_per_1m,
    credit_multiplier         = EXCLUDED.credit_multiplier,
    recommended_for           = EXCLUDED.recommended_for,
    quality_score             = EXCLUDED.quality_score,
    speed_score               = EXCLUDED.speed_score,
    is_active                 = TRUE,
    display_order             = EXCLUDED.display_order,
    description               = EXCLUDED.description,
    updated_at                = NOW();

-- ---------------------------------------------------------------------------
-- 2. Backfill the two models that were being used with NO pricing row.
--    claude-sonnet-4.5 is the configured analytics fallback and took 9 calls /
--    147K tokens in a single 3h window while reporting total_price = NULL.
-- ---------------------------------------------------------------------------
INSERT INTO ai_models (
    model_id, name, provider, category, tier,
    max_tokens, context_window,
    supports_streaming, supports_images, supports_function_calling, supports_json_mode,
    input_price_per_1m, output_price_per_1m, credit_multiplier, is_free,
    recommended_for, quality_score, speed_score, is_active, display_order, description
) VALUES
    ('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 'Anthropic', 'general', 'premium',
     64000, 1000000, TRUE, TRUE, TRUE, TRUE,
     3.000000, 15.000000, 3.00, FALSE,
     ARRAY[]::text[], 5, 4, TRUE, 40,
     'Priced for cost reporting. Deliberately not recommended_for anything - too expensive for batch work.'),
    ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'Google', 'general', 'standard',
     65536, 1048576, TRUE, TRUE, TRUE, TRUE,
     0.300000, 2.500000, 1.50, FALSE,
     ARRAY['knowledge_base_figure']::text[], 4, 5, TRUE, 5,
     'Cheap vision-capable workhorse. Fallback for the text use cases and primary for figure captioning.')
ON CONFLICT (model_id) DO UPDATE SET
    input_price_per_1m  = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    credit_multiplier   = EXCLUDED.credit_multiplier,
    updated_at          = NOW();

-- ---------------------------------------------------------------------------
-- 3. google/gemini-2.5-pro output was priced at $5/1M; OpenRouter charges $10/1M.
--    Every gemini-2.5-pro row in ai_token_usage was therefore under-costed 2x.
-- ---------------------------------------------------------------------------
UPDATE ai_models
   SET output_price_per_1m = 10.000000,
       input_price_per_1m  = 1.250000,
       updated_at          = NOW()
 WHERE model_id = 'google/gemini-2.5-pro';

-- ---------------------------------------------------------------------------
-- 4. google/gemini-3-pro-preview is not a real OpenRouter model id. It returned
--    404 on all 51 attempts in the sampled window. Deactivate so the registry
--    stops handing it out.
-- ---------------------------------------------------------------------------
UPDATE ai_models
   SET is_active       = FALSE,
       recommended_for = ARRAY[]::text[],
       notes           = COALESCE(notes || ' | ', '') ||
                         'Deactivated V449: model id does not exist on OpenRouter (404 on every call).',
       updated_at      = NOW()
 WHERE model_id = 'google/gemini-3-pro-preview';

-- ---------------------------------------------------------------------------
-- 5. Shrink the analytics chain to [gpt-5.6-luna, gemini-2.5-flash].
--    Strips 'analytics' from the 13 models that previously claimed it, so the
--    opus/gpt-5.4/gemini-pro tier can no longer be reached no matter how the
--    registry sorts. This is the change that actually stops the burn.
-- ---------------------------------------------------------------------------
UPDATE ai_models
   SET recommended_for = array_remove(recommended_for, 'analytics'),
       updated_at      = NOW()
 WHERE 'analytics' = ANY(recommended_for)
   AND model_id NOT IN ('openai/gpt-5.6-luna', 'google/gemini-2.5-flash');

UPDATE ai_models
   SET recommended_for = array_append(recommended_for, 'analytics'),
       updated_at      = NOW()
 WHERE model_id = 'google/gemini-2.5-flash'
   AND NOT ('analytics' = ANY(recommended_for));

-- ---------------------------------------------------------------------------
-- 6. Point every text use case at gpt-5.6-luna, with gemini-2.5-flash as the
--    single fallback. Vision (knowledge_base_figure), video, image, tts and
--    embedding are deliberately untouched.
-- ---------------------------------------------------------------------------
UPDATE ai_model_defaults
   SET default_model_id  = 'openai/gpt-5.6-luna',
       fallback_model_id = 'google/gemini-2.5-flash',
       updated_at        = NOW()
 WHERE use_case IN (
    'analytics', 'content', 'outline', 'copilot', 'agent', 'evaluation',
    'questions', 'translation', 'knowledge_base_summary', 'knowledge_base_qa', 'lecture'
 );
