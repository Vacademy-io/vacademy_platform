-- ================================================================================
-- V442: give the 'questions' use case a real model default + fallback
--
-- Found while diagnosing a stuck question-paper job on prod. The log said:
--
--   Model resolved for 'questions': primary=google/gemini-2.5-flash fallbacks=[]
--
-- Every other use case resolves with a fallback (…fallbacks=['deepseek/deepseek-v3.2'])
-- because it has a row in ai_model_defaults. 'questions' — which backs EVERY
-- question generator on the platform (text, PDF, image, audio, and now knowledge-base
-- papers) — never had one. `resolve_models` therefore degraded to the hard-coded
-- DEFAULT_HARD_FALLBACK in model_selection.py with an EMPTY fallback list, so when
-- the primary returned unusable output there was no second model to try: the row
-- burned its 3 retries and gave up.
--
-- Two consequences of having no row here:
--   1. No fallback, as above.
--   2. Question-generation quality could not be retargeted from the DB like every
--      other use case — it was pinned to whatever DEFAULT_HARD_FALLBACK happened
--      to be, which is currently google/gemini-2.5-flash. That model is scheduled
--      for retirement on 2026-10-16, so this row also makes the eventual swap a
--      one-line UPDATE instead of a code change and redeploy.
--
-- DO NOTHING so an ops-tuned row is never clobbered on re-deploy.
-- ================================================================================
INSERT INTO ai_model_defaults (use_case, default_model_id, fallback_model_id, free_tier_model_id, description)
VALUES (
    'questions',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-v3.2',
    'xiaomi/mimo-v2-flash:free',
    'Question generation for every source: topic/text, PDF, image, audio, and '
    'knowledge-base question papers. Retarget here rather than in code.'
)
ON CONFLICT (use_case) DO NOTHING;
