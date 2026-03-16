-- HR Leave Balance table
CREATE TABLE IF NOT EXISTS hr_leave_balance (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    leave_type_id VARCHAR(255) NOT NULL REFERENCES hr_leave_type(id),
    year INT NOT NULL,
    opening_balance DECIMAL(5,1) DEFAULT 0,
    accrued DECIMAL(5,1) DEFAULT 0,
    used DECIMAL(5,1) DEFAULT 0,
    adjustment DECIMAL(5,1) DEFAULT 0,
    carried_forward DECIMAL(5,1) DEFAULT 0,
    encashed DECIMAL(5,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX idx_hr_leave_balance_employee ON hr_leave_balance(employee_id);

-- HR Leave Application table
CREATE TABLE IF NOT EXISTS hr_leave_application (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    institute_id VARCHAR(255) NOT NULL,
    leave_type_id VARCHAR(255) NOT NULL REFERENCES hr_leave_type(id),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days DECIMAL(5,1) NOT NULL,
    is_half_day BOOLEAN DEFAULT FALSE,
    half_day_type VARCHAR(10),
    reason TEXT,
    document_file_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING',
    applied_to VARCHAR(255),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_leave_app_employee ON hr_leave_application(employee_id);
CREATE INDEX idx_hr_leave_app_institute ON hr_leave_application(institute_id);
CREATE INDEX idx_hr_leave_app_status ON hr_leave_application(status);
CREATE INDEX idx_hr_leave_app_dates ON hr_leave_application(from_date, to_date);
