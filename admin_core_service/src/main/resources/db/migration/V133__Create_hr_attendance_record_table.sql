-- HR Attendance Record table
CREATE TABLE IF NOT EXISTS hr_attendance_record (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(255) NOT NULL REFERENCES hr_employee_profile(id),
    institute_id VARCHAR(255) NOT NULL,
    attendance_date DATE NOT NULL,
    shift_id VARCHAR(255) REFERENCES hr_shift(id),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    break_duration_min INT,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    check_in_ip VARCHAR(45),
    check_out_ip VARCHAR(45),
    source VARCHAR(20) DEFAULT 'MANUAL',
    remarks TEXT,
    is_regularized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

CREATE INDEX idx_hr_attendance_institute ON hr_attendance_record(institute_id);
CREATE INDEX idx_hr_attendance_date ON hr_attendance_record(attendance_date);
CREATE INDEX idx_hr_attendance_employee_date ON hr_attendance_record(employee_id, attendance_date);
CREATE INDEX idx_hr_attendance_status ON hr_attendance_record(status);
