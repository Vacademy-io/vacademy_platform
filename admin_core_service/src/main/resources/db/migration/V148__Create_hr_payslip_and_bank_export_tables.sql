-- HR Payslip table
CREATE TABLE IF NOT EXISTS hr_payslip (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    payroll_entry_id VARCHAR(255) NOT NULL UNIQUE REFERENCES hr_payroll_entry(id),
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    institute_id VARCHAR(255) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    file_id VARCHAR(255),
    file_url TEXT,
    generated_at TIMESTAMP,
    emailed_at TIMESTAMP,
    email_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_payslip_employee ON hr_payslip(employee_id);
CREATE INDEX idx_hr_payslip_institute ON hr_payslip(institute_id);
CREATE INDEX idx_hr_payslip_period ON hr_payslip(year, month);

-- HR Bank Export Log table
CREATE TABLE IF NOT EXISTS hr_bank_export_log (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    payroll_run_id VARCHAR(255) NOT NULL REFERENCES hr_payroll_run(id),
    institute_id VARCHAR(255) NOT NULL,
    file_id VARCHAR(255),
    file_name VARCHAR(255),
    format VARCHAR(20),
    total_records INT,
    total_amount DECIMAL(18,2),
    generated_by VARCHAR(255),
    generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_bank_export_run ON hr_bank_export_log(payroll_run_id);
