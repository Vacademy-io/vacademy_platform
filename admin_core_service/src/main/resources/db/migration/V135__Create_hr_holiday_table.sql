-- HR Holiday Calendar table
CREATE TABLE IF NOT EXISTS hr_holiday (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) DEFAULT 'NATIONAL',
    is_optional BOOLEAN DEFAULT FALSE,
    max_optional_allowed INT,
    year INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(institute_id, date)
);

CREATE INDEX idx_hr_holiday_institute_year ON hr_holiday(institute_id, year);
