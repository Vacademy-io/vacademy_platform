-- Trim the public demo-request form down to the essentials.
--
-- The general link used to render the whole question catalogue (7 steps, ~30 questions).
-- Everything beyond "who are you, how do we reach you, what do you want" now belongs to the
-- real onboarding we run after the first payment, so the demo link asks only these five.
-- The catalogue itself is untouched — CUSTOM links can still show any question.

UPDATE public.onboarding_link
SET visible_question_keys = '["organization_name","full_name","work_email","phone","requirements","learners_now","learners_6m"]'::jsonb,
    intro_heading         = 'See Vacademy in action',
    intro_subheading      = 'Four details and what you''re looking for — we''ll open a demo tailored to it.',
    updated_at            = CURRENT_TIMESTAMP
WHERE slug = 'general';
