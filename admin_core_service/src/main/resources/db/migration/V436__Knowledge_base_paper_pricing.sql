-- ================================================================================
-- V436: Pricing for question papers generated from a knowledge base
--
-- Phase 2 of the Knowledge Base feature (V435): a teacher picks chapters from a
-- KB's real outline, edits a blueprint, and generates a full question paper whose
-- questions cite the page they came from and reuse the book's actual diagrams.
--
-- Priced at the three moments a teacher actually spends money, so the number on
-- screen always matches the button they are about to press:
--
--   kb_paper_blueprint  — planning the paper (also each chat refinement)
--   kb_paper_questions  — generating the questions (includes the validation pass)
--   kb_paper_regenerate — redoing ONE question they did not like
--
-- request_type is 'assessment', which is ALREADY in the ai_token_usage CHECK.
-- That is deliberate: these are assessment artifacts, and reusing an allowed
-- value avoids the CHECK-expansion trap that silently swallowed charges in
-- V325/V435. Adding a new request_type here would have required another
-- DROP+ADD of that constraint.
--
-- MUST stay in sync with DEFAULT_TOOL_PRICING in
-- ai_service/app/services/tool_cost_estimator.py AND computeToolCredits in
-- frontend-admin-dashboard/src/services/ai-credits/get-ai-credits.ts.
-- Three places. Change one, change all three.
-- ================================================================================

INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    -- One planning call over the KB's summary tree, returning the editable
    -- blueprint. Cheap on purpose: the blueprint is where a teacher's judgment
    -- belongs, and charging much for it would push people to accept the first
    -- structure offered instead of fixing it before 60 questions get written.
    ('kb_paper_blueprint',  'assessment', 2, 0,   'flat',      '{}'::jsonb),

    -- Whole-paper generation, priced per question so the preview reads
    -- "60 questions ≈ 95 credits". flat_base covers the retrieval and the
    -- validation pass (answer keys, near-duplicates, marks total) that runs
    -- after generation — the step everyone skips and the one that makes a paper
    -- shippable rather than a demo.
    ('kb_paper_questions',  'assessment', 5, 1.5, 'questions', '{}'::jsonb),

    -- Redoing a single question. Must stay far below a whole paper, or teachers
    -- accept questions they dislike rather than pay to fix them — which is
    -- exactly the behaviour that makes the output feel untrustworthy.
    ('kb_paper_regenerate', 'assessment', 2, 0,   'flat',      '{}'::jsonb)
ON CONFLICT (tool_key) DO NOTHING;
