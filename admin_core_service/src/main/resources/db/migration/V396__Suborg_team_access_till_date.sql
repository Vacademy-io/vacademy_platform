-- Sub-org team members (the "Remove from sub-org" button on the Team-members tab)
-- can now be SOFT-removed: kept ACTIVE until a chosen "last access date", after which
-- the nightly SubOrgTeamAccessExpiryJob flips them to INACTIVE. HARD removal keeps the
-- existing behaviour (status -> INACTIVE immediately) and stamps this with the cut-off
-- time for audit. NULL means "no scheduled expiry" (the pre-existing default).
ALTER TABLE faculty_subject_package_session_mapping
    ADD COLUMN access_till_date TIMESTAMP NULL;
