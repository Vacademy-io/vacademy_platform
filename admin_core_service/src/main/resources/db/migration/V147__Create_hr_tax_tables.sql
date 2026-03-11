-- HR Tax Configuration table (per institute per country)
CREATE TABLE IF NOT EXISTS hr_tax_configuration (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    state_code VARCHAR(10),
    financial_year_start_month INT DEFAULT 4,
    tax_rules JSONB DEFAULT '{}',
    employer_contributions JSONB DEFAULT '{}',
    statutory_settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, country_code)
);

CREATE INDEX idx_hr_tax_config_institute ON hr_tax_configuration(institute_id);

-- HR Tax Declaration table
CREATE TABLE IF NOT EXISTS hr_tax_declaration (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    financial_year VARCHAR(10) NOT NULL,
    regime VARCHAR(20),
    declarations JSONB NOT NULL DEFAULT '{}',
    proof_submitted BOOLEAN DEFAULT FALSE,
    proof_verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, financial_year)
);

CREATE INDEX idx_hr_tax_declaration_employee ON hr_tax_declaration(employee_id);

-- HR Tax Computation table
CREATE TABLE IF NOT EXISTS hr_tax_computation (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    financial_year VARCHAR(10) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    projected_annual_income DECIMAL(15,2),
    projected_annual_tax DECIMAL(15,2),
    projected_monthly_tax DECIMAL(15,2),
    actual_income_till_date DECIMAL(15,2),
    actual_tax_deducted DECIMAL(15,2),
    total_exemptions DECIMAL(15,2),
    total_deductions_80c DECIMAL(15,2),
    computation_details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_tax_computation_employee ON hr_tax_computation(employee_id);
CREATE INDEX idx_hr_tax_computation_fy ON hr_tax_computation(financial_year);
