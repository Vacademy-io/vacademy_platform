-- A person can be a lead independently at multiple institutes (e.g. converted at one,
-- fresh lead at another). user_lead_profile was previously unique on user_id alone,
-- which caused duplicate-key errors on lead submission whenever the same user_id
-- already had a profile under a different institute_id. Move to a composite key.
--
-- Safe to apply directly: verified against prod data (2026-07-16) that there are zero
-- NULLs in user_id/institute_id and zero existing (user_id, institute_id) duplicates,
-- since the old global-unique constraint already prevented any such collision.
ALTER TABLE user_lead_profile DROP CONSTRAINT user_lead_profile_user_id_key;
ALTER TABLE user_lead_profile ADD CONSTRAINT user_lead_profile_user_id_institute_id_key UNIQUE (user_id, institute_id);

-- timeline_event has no institute_id column, so COUNSELOR_ASSIGNED events (type =
-- 'USER_LEAD_PROFILE') were keyed by type_id = user_lead_profile.user_id. That was
-- unambiguous only because user_id used to be globally unique on user_lead_profile.
-- Now that a user can have one profile per institute, re-key these events onto
-- user_lead_profile.id (still unique) while the user_id -> profile mapping is still
-- 1:1, before any second-institute profile can exist.
UPDATE timeline_event te
SET type_id = ulp.id
FROM user_lead_profile ulp
WHERE te.type = 'USER_LEAD_PROFILE' AND te.type_id = ulp.user_id;
