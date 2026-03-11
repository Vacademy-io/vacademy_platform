-- HR Reimbursement table
CREATE TABLE IF NOT EXISTS hr_reimbursement (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    institute_id VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    receipt_file_id VARCHAR(255),
    expense_date DATE,
    status VARCHAR(20) DEFAULT 'PENDING',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    payroll_entry_id VARCHAR(255) REFERENCES hr_payroll_entry(id),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_reimbursement_employee ON hr_reimbursement(employee_id);
CREATE INDEX idx_hr_reimbursement_institute ON hr_reimbursement(institute_id);
CREATE INDEX idx_hr_reimbursement_status ON hr_reimbursement(status);
