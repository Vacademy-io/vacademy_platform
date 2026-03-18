-- HR Employee Profile table (1:1 with users)
CREATE TABLE IF NOT EXISTS hr_employee_profile (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    institute_id VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50),
    department_id VARCHAR(255) REFERENCES hr_department(id),
    designation_id VARCHAR(255) REFERENCES hr_designation(id),
    reporting_manager_id VARCHAR(255) REFERENCES hr_employee_profile(id),
    employment_type VARCHAR(20),
    employment_status VARCHAR(20) DEFAULT 'ACTIVE',
    join_date DATE NOT NULL,
    probation_end_date DATE,
    confirmation_date DATE,
    notice_period_days INT DEFAULT 30,
    resignation_date DATE,
    last_working_date DATE,
    exit_reason TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(25),
    emergency_contact_relation VARCHAR(50),
    nationality VARCHAR(100),
    blood_group VARCHAR(5),
    marital_status VARCHAR(20),
    pan_number VARCHAR(20),
    tax_id_number VARCHAR(50),
    uan_number VARCHAR(20),
    statutory_info JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, employee_code)
);

CREATE INDEX idx_hr_employee_user ON hr_employee_profile(user_id);
CREATE INDEX idx_hr_employee_institute ON hr_employee_profile(institute_id);
CREATE INDEX idx_hr_employee_department ON hr_employee_profile(department_id);
CREATE INDEX idx_hr_employee_designation ON hr_employee_profile(designation_id);
CREATE INDEX idx_hr_employee_manager ON hr_employee_profile(reporting_manager_id);
CREATE INDEX idx_hr_employee_status ON hr_employee_profile(employment_status);
