-- HR Payroll Run table
CREATE TABLE IF NOT EXISTS hr_payroll_run (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    run_date DATE,
    status VARCHAR(20) DEFAULT 'DRAFT',
    total_employees INT,
    total_gross DECIMAL(18,2),
    total_deductions DECIMAL(18,2),
    total_net_pay DECIMAL(18,2),
    total_employer_cost DECIMAL(18,2),
    processed_by VARCHAR(255),
    processed_at TIMESTAMP,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, month, year)
);

CREATE INDEX idx_hr_payroll_run_institute ON hr_payroll_run(institute_id);
CREATE INDEX idx_hr_payroll_run_period ON hr_payroll_run(year, month);
