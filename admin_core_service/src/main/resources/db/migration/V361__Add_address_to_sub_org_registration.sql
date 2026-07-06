-- Optional postal address for open sub-org registration, collected when the
-- template sets COLLECT_ADDRESS=true; stamped onto the spawned institute.
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS state VARCHAR(120);
ALTER TABLE sub_org_registration ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
