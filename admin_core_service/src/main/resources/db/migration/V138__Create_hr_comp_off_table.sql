-- HR Compensatory Off table
CREATE TABLE IF NOT EXISTS hr_comp_off (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    worked_on_date DATE NOT NULL,
    earned_days DECIMAL(3,1) DEFAULT 1.0,
    expiry_date DATE,
    used BOOLEAN DEFAULT FALSE,
    used_leave_application_id VARCHAR(255) REFERENCES hr_leave_application(id),
    approved_by VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_comp_off_employee ON hr_comp_off(employee_id);
CREATE INDEX idx_hr_comp_off_status ON hr_comp_off(status);
