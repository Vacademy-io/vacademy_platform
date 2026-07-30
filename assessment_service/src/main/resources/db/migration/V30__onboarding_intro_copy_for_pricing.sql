-- The form no longer ends at a demo handoff — it hands off to the plan builder — so the intro
-- copy promising "a demo tailored to it" is now wrong. Point it at pricing instead.

UPDATE public.onboarding_link
SET intro_heading    = 'Build your Vacademy plan',
    intro_subheading = 'Four details and what you''re looking for, and we''ll price it up for you.',
    updated_at       = CURRENT_TIMESTAMP
WHERE slug = 'general';
