-- Create table for mapping domain/subdomain to institute and role
CREATE TABLE IF NOT EXISTS institute_domain_routing (
    id VARCHAR(255) PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes to speed up resolution
CREATE INDEX IF NOT EXISTS idx_idr_domain ON institute_domain_routing(LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_idr_domain_subdomain ON institute_domain_routing(LOWER(domain), subdomain);
CREATE INDEX IF NOT EXISTS idx_idr_institute_id ON institute_domain_routing(institute_id);

-- Optional FK (commented out to avoid cross-service migration coupling)
-- ALTER TABLE institute_domain_routing
--   ADD CONSTRAINT fk_idr_institute
--   FOREIGN KEY (institute_id) REFERENCES institutes(id);


