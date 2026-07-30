-- Who gets told about new onboarding submissions and saved pricing plans.
-- Shreyash was seeded in V16; add Riya. Manage the list from the Notifications tab rather
-- than here — this is just the starting state.

INSERT INTO public.onboarding_notification_recipient (id, email, name, is_active)
VALUES ('seed-recipient-riya', 'riya@vidyayatan.com', 'Riya', true)
ON CONFLICT DO NOTHING;

-- Make sure the V16 seed is present and active even if it was deactivated at some point.
INSERT INTO public.onboarding_notification_recipient (id, email, name, is_active)
VALUES ('seed-recipient-shreyash', 'shreyash@vidyayatan.com', 'Shreyash', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;
