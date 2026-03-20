-- HR Department table (hierarchical with self-reference)
CREATE TABLE IF NOT EXISTS hr_department (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    parent_id VARCHAR(255) REFERENCES hr_department(id),
    head_user_id VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, code)
);

CREATE INDEX idx_hr_department_institute ON hr_department(institute_id);
CREATE INDEX idx_hr_department_parent ON hr_department(parent_id);

-- HR Designation table
CREATE TABLE IF NOT EXISTS hr_designation (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    level INT,
    grade VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, code)
);

CREATE INDEX idx_hr_designation_institute ON hr_designation(institute_id);
