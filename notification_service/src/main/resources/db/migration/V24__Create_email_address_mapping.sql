CREATE TABLE email_address_mapping (
    id VARCHAR(255) PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    email_type VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_email_address_mapping
    ON email_address_mapping(email_address, institute_id);
