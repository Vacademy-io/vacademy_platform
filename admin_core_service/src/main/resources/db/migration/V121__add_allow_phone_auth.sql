-- Add allow_phone_auth column to institute_domain_routing table
-- Nullable boolean, defaults to null (falsy) for backward compatibility
ALTER TABLE institute_domain_routing ADD COLUMN IF NOT EXISTS allow_phone_auth BOOLEAN;
