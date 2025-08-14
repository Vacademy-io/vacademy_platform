-- Add redirect column to institute_domain_routing for client-side redirection
ALTER TABLE institute_domain_routing
    ADD COLUMN IF NOT EXISTS redirect VARCHAR(255);

-- Optional: index if frequently filtered (not required for resolution query)
-- CREATE INDEX IF NOT EXISTS idx_idr_redirect ON institute_domain_routing(redirect);


