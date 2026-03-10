-- HR Employee Loan table
CREATE TABLE IF NOT EXISTS hr_employee_loan (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    institute_id VARCHAR(255) NOT NULL,
    loan_type VARCHAR(30),
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) DEFAULT 0,
    tenure_months INT NOT NULL,
    emi_amount DECIMAL(15,2) NOT NULL,
    disbursed_amount DECIMAL(15,2),
    balance_amount DECIMAL(15,2),
    start_month INT,
    start_year INT,
    status VARCHAR(20) DEFAULT 'PENDING',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_loan_employee ON hr_employee_loan(employee_id);
CREATE INDEX idx_hr_loan_institute ON hr_employee_loan(institute_id);
CREATE INDEX idx_hr_loan_status ON hr_employee_loan(status);

-- HR Loan Repayment table
CREATE TABLE IF NOT EXISTS hr_loan_repayment (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    loan_id VARCHAR(255) NOT NULL REFERENCES hr_employee_loan(id),
    payroll_entry_id VARCHAR(255) REFERENCES hr_payroll_entry(id),
    amount DECIMAL(15,2) NOT NULL,
    repayment_date DATE,
    month INT,
    year INT,
    balance_after DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_loan_repayment_loan ON hr_loan_repayment(loan_id);
