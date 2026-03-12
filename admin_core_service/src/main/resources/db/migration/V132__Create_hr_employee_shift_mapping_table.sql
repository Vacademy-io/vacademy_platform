-- HR Employee Shift Mapping table
CREATE TABLE IF NOT EXISTS hr_employee_shift_mapping (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    shift_id VARCHAR(255) NOT NULL REFERENCES hr_shift(id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_shift_mapping_employee ON hr_employee_shift_mapping(employee_id);
CREATE INDEX idx_hr_shift_mapping_shift ON hr_employee_shift_mapping(shift_id);
