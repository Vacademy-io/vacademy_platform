-- HR Payroll Entry table
CREATE TABLE IF NOT EXISTS hr_payroll_entry (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    payroll_run_id VARCHAR(255) NOT NULL REFERENCES hr_payroll_run(id),
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    salary_structure_id VARCHAR(255) REFERENCES hr_employee_salary_structure(id),
    gross_salary DECIMAL(15,2) NOT NULL,
    total_earnings DECIMAL(15,2),
    total_deductions DECIMAL(15,2),
    total_employer_contributions DECIMAL(15,2),
    net_pay DECIMAL(15,2) NOT NULL,
    total_working_days INT,
    days_present DECIMAL(5,1),
    days_absent DECIMAL(5,1),
    days_on_leave DECIMAL(5,1),
    days_holiday INT,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    arrears DECIMAL(15,2) DEFAULT 0,
    reimbursements DECIMAL(15,2) DEFAULT 0,
    loan_deduction DECIMAL(15,2) DEFAULT 0,
    other_earnings DECIMAL(15,2) DEFAULT 0,
    other_deductions DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CALCULATED',
    hold_reason TEXT,
    bank_account_id VARCHAR(255) REFERENCES hr_employee_bank_detail(id),
    payment_ref VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX idx_hr_payroll_entry_run ON hr_payroll_entry(payroll_run_id);
CREATE INDEX idx_hr_payroll_entry_employee ON hr_payroll_entry(employee_id);

-- HR Payroll Entry Component table
CREATE TABLE IF NOT EXISTS hr_payroll_entry_component (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    payroll_entry_id VARCHAR(255) NOT NULL REFERENCES hr_payroll_entry(id) ON DELETE CASCADE,
    component_id VARCHAR(255) NOT NULL REFERENCES hr_salary_component(id),
    component_type VARCHAR(30),
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_payroll_entry_comp_entry ON hr_payroll_entry_component(payroll_entry_id);
