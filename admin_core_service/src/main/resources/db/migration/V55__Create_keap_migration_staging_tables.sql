CREATE TABLE IF NOT EXISTS migration_staging_keap_users (
    id VARCHAR(255) PRIMARY KEY,
    keap_contact_id VARCHAR(255),
    email VARCHAR(255),
    record_type VARCHAR(255),
    raw_data TEXT,
    migration_status VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS migration_staging_keap_payments (
    id VARCHAR(255) PRIMARY KEY,
    keap_contact_id VARCHAR(255),
    raw_data TEXT,
    migration_status VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keap_users_status ON migration_staging_keap_users(migration_status);
CREATE INDEX IF NOT EXISTS idx_keap_users_record_type ON migration_staging_keap_users(record_type);
CREATE INDEX IF NOT EXISTS idx_keap_payments_status ON migration_staging_keap_payments(migration_status);
CREATE INDEX IF NOT EXISTS idx_keap_payments_contact_id ON migration_staging_keap_payments(keap_contact_id);
