-- Learner badges manually awarded by admins/institutes to recognise students.
-- Distinct from the auto-unlock (frontend-computed) badges: a manual award is a
-- durable per-student record (one row per student x badge) carrying the issuer,
-- the reason, and an ACTIVE/REVOKED status (revoke keeps the row for audit).
-- badge_id references a badge configured in the BADGES_REWARDS_SETTING institute
-- setting; badge_name/icon/description are snapshotted at award time so the award
-- survives later edits/deletes of the badge config.

CREATE TABLE public.learner_badge (
    id varchar(255) NOT NULL,
    user_id varchar(255) NOT NULL,
    institute_id varchar(255) NOT NULL,
    badge_id varchar(255) NOT NULL,
    badge_name varchar(255) NULL,
    badge_icon varchar(255) NULL,
    badge_description text NULL,
    reason text NULL,
    status varchar(255) DEFAULT 'ACTIVE' NOT NULL,
    awarded_by_user_id varchar(255) NULL,
    awarded_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_by_user_id varchar(255) NULL,
    revoked_at timestamp NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT learner_badge_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_learner_badge_user_id ON public.learner_badge USING btree (user_id);
CREATE INDEX idx_learner_badge_institute_id ON public.learner_badge USING btree (institute_id);
CREATE INDEX idx_learner_badge_status ON public.learner_badge USING btree (status);

-- One active award per (user, badge, institute); a revoked row can coexist with a re-award.
CREATE UNIQUE INDEX idx_learner_badge_unique_active ON public.learner_badge
    USING btree (user_id, badge_id, institute_id)
    WHERE status = 'ACTIVE';

-- Reuse the shared updated_at trigger function defined in V3__Create_tag_system.sql.
CREATE TRIGGER trigger_update_learner_badge_updated_at
    BEFORE UPDATE ON public.learner_badge
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_tags();
