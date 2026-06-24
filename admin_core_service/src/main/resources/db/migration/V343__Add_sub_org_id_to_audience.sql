-- Link an audience list (campaign) to a sub-org. Nullable: most campaigns have no sub-org.
-- Stores the child-institute id (same value as ssigm.sub_org_id / enroll_invite.sub_org_id).
ALTER TABLE audience ADD COLUMN IF NOT EXISTS sub_org_id VARCHAR(255);

-- FK to the sub-org institute, matching ssigm.sub_org_id (V34) and enroll_invite.sub_org_id (V161).
-- Column is brand-new (all null), so the constraint adds cleanly.
ALTER TABLE audience ADD CONSTRAINT fk_audience_sub_org
    FOREIGN KEY (sub_org_id) REFERENCES institutes(id);

CREATE INDEX IF NOT EXISTS idx_audience_sub_org_id ON audience(sub_org_id);
