-- HR Employee Salary Structure table
CREATE TABLE IF NOT EXISTS hr_employee_salary_structure (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    template_id VARCHAR(255) REFERENCES hr_salary_template(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    ctc_annual DECIMAL(15,2) NOT NULL,
    ctc_monthly DECIMAL(15,2),
    gross_monthly DECIMAL(15,2),
    net_monthly DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    revision_reason TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_salary_structure_employee ON hr_employee_salary_structure(employee_id);
CREATE INDEX idx_hr_salary_structure_status ON hr_employee_salary_structure(status);

-- HR Employee Salary Component table
CREATE TABLE IF NOT EXISTS hr_employee_salary_component (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    salary_structure_id VARCHAR(255) NOT NULL REFERENCES hr_employee_salary_structure(id) ON DELETE CASCADE,
    component_id VARCHAR(255) NOT NULL REFERENCES hr_salary_component(id),
    monthly_amount DECIMAL(15,2) NOT NULL,
    annual_amount DECIMAL(15,2) NOT NULL,
    calculation_type VARCHAR(30),
    percentage_value DECIMAL(8,4),
    is_overridden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_emp_salary_comp_structure ON hr_employee_salary_component(salary_structure_id);
