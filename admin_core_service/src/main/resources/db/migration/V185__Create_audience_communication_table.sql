CREATE TABLE IF NOT EXISTS audience_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id VARCHAR(255) NOT NULL,
    audience_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    template_name VARCHAR(255),
    subject VARCHAR(500),
    body TEXT,
    variable_mapping TEXT,
    filters TEXT,
    recipient_count INT NOT NULL DEFAULT 0,
    successful INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    skipped INT NOT NULL DEFAULT 0,
    batch_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_communication_audience_id ON audience_communication(audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_communication_institute_id ON audience_communication(institute_id);
