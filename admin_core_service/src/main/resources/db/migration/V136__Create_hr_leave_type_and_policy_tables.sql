-- HR Leave Type table
CREATE TABLE IF NOT EXISTS hr_leave_type (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    is_paid BOOLEAN DEFAULT TRUE,
    is_carry_forward BOOLEAN DEFAULT FALSE,
    max_carry_forward INT DEFAULT 0,
    is_encashable BOOLEAN DEFAULT FALSE,
    requires_document BOOLEAN DEFAULT FALSE,
    min_days DECIMAL(3,1) DEFAULT 0.5,
    max_consecutive_days INT,
    applicable_gender VARCHAR(10) DEFAULT 'ALL',
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, code)
);

CREATE INDEX idx_hr_leave_type_institute ON hr_leave_type(institute_id);

-- HR Leave Policy table
CREATE TABLE IF NOT EXISTS hr_leave_policy (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    leave_type_id VARCHAR(255) NOT NULL REFERENCES hr_leave_type(id),
    annual_quota DECIMAL(5,1) NOT NULL,
    accrual_type VARCHAR(20) DEFAULT 'YEARLY',
    accrual_amount DECIMAL(5,2),
    pro_rata_enabled BOOLEAN DEFAULT TRUE,
    applicable_after_days INT DEFAULT 0,
    applicable_employment_types JSONB DEFAULT '["FULL_TIME"]',
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_leave_policy_institute ON hr_leave_policy(institute_id);
CREATE INDEX idx_hr_leave_policy_type ON hr_leave_policy(leave_type_id);
