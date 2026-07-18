-- The onboarding_instance's subject_user_id anchors WHICH lead/student side-view the
-- instance is visible under, and must never change after the instance is started --
-- otherwise the instance "disappears" from the profile the admin was working from the
-- moment a parent-vs-student resolution reassigns it. resolved_subject_user_id tracks
-- the real student separately: once a parent fills a step on a lead's behalf and the
-- real student is created/linked, every subsequent identity-touching side effect (role
-- grant, credentials, course enrollment) targets this column instead of subject_user_id,
-- while subject_user_id keeps pointing at the original lead throughout.
ALTER TABLE onboarding_instance
    ADD COLUMN resolved_subject_user_id VARCHAR(255) NULL;
