-- HR Salary Revision History table
CREATE TABLE IF NOT EXISTS hr_salary_revision (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    old_structure_id VARCHAR(255) REFERENCES hr_employee_salary_structure(id),
    new_structure_id VARCHAR(255) NOT NULL REFERENCES hr_employee_salary_structure(id),
    old_ctc DECIMAL(15,2),
    new_ctc DECIMAL(15,2),
    increment_pct DECIMAL(5,2),
    reason TEXT,
    effective_date DATE NOT NULL,
    approved_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_salary_revision_employee ON hr_salary_revision(employee_id);
