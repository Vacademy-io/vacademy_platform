-- HR Employee Bank Detail table
CREATE TABLE IF NOT EXISTS hr_employee_bank_detail (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    account_holder_name VARCHAR(255),
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255),
    branch_name VARCHAR(255),
    ifsc_code VARCHAR(20),
    swift_code VARCHAR(20),
    routing_number VARCHAR(20),
    iban VARCHAR(50),
    is_primary BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_bank_employee ON hr_employee_bank_detail(employee_id);

-- HR Employee Document table
CREATE TABLE IF NOT EXISTS hr_employee_document (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    document_type VARCHAR(50),
    document_name VARCHAR(255),
    file_id VARCHAR(255),
    file_url TEXT,
    expiry_date DATE,
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_document_employee ON hr_employee_document(employee_id);
