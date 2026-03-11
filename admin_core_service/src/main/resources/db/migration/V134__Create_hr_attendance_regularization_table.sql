-- HR Attendance Regularization table
CREATE TABLE IF NOT EXISTS hr_attendance_regularization (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    attendance_id VARCHAR(255) NOT NULL REFERENCES hr_attendance_record(id),
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    original_status VARCHAR(20),
    requested_status VARCHAR(20),
    original_check_in TIMESTAMP,
    original_check_out TIMESTAMP,
    requested_check_in TIMESTAMP,
    requested_check_out TIMESTAMP,
    reason TEXT NOT NULL,
    approval_status VARCHAR(20) DEFAULT 'PENDING',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_regularization_employee ON hr_attendance_regularization(employee_id);
CREATE INDEX idx_hr_regularization_status ON hr_attendance_regularization(approval_status);
