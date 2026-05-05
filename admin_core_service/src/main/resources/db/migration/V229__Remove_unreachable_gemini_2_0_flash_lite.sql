-- V221 seeded `google/gemini-2.0-flash-lite-001`, which is published on the
-- Gemini API (AI Studio) but NOT on Vertex AI under the same publisher path.
-- BYOK-Vertex tenants hit a 404 ("Publisher Model ... was not found") on every
-- call. The model has been removed from all default code paths; remove the row
-- from the registry so it stops appearing in the FE model picker and credit
-- estimator. There are no FK constraints on ai_models.model_id — historical
-- ai_token_usage rows referencing this id by string remain valid.
DELETE FROM ai_models WHERE model_id = 'google/gemini-2.0-flash-lite-001';
