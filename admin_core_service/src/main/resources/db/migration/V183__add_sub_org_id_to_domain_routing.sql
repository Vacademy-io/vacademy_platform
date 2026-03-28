-- Add sub_org_id column to institute_domain_routing for sub-org branding resolution
ALTER TABLE institute_domain_routing ADD COLUMN sub_org_id VARCHAR(255);
