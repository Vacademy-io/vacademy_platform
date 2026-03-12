-- HR Salary Template table
CREATE TABLE IF NOT EXISTS hr_salary_template (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_salary_template_institute ON hr_salary_template(institute_id);

-- HR Salary Template Component table
CREATE TABLE IF NOT EXISTS hr_salary_template_component (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    template_id VARCHAR(255) NOT NULL REFERENCES hr_salary_template(id) ON DELETE CASCADE,
    component_id VARCHAR(255) NOT NULL REFERENCES hr_salary_component(id),
    calculation_type VARCHAR(30) NOT NULL,
    percentage_value DECIMAL(8,4),
    fixed_value DECIMAL(15,2),
    formula TEXT,
    min_value DECIMAL(15,2),
    max_value DECIMAL(15,2),
    display_order INT DEFAULT 0,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_template_comp_template ON hr_salary_template_component(template_id);
CREATE INDEX idx_hr_template_comp_component ON hr_salary_template_component(component_id);
