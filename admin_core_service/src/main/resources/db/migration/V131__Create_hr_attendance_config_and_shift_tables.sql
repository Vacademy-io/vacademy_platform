-- HR Attendance Config table (per institute)
CREATE TABLE IF NOT EXISTS hr_attendance_config (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL UNIQUE,
    mode VARCHAR(20) NOT NULL DEFAULT 'DAY_LEVEL',
    auto_checkout_enabled BOOLEAN DEFAULT FALSE,
    auto_checkout_time TIME,
    geo_fence_enabled BOOLEAN DEFAULT FALSE,
    geo_fence_lat DOUBLE PRECISION,
    geo_fence_lng DOUBLE PRECISION,
    geo_fence_radius_m INT,
    ip_restriction_enabled BOOLEAN DEFAULT FALSE,
    allowed_ips JSONB DEFAULT '[]',
    overtime_enabled BOOLEAN DEFAULT FALSE,
    overtime_threshold_min INT DEFAULT 480,
    half_day_threshold_min INT DEFAULT 240,
    weekend_days JSONB DEFAULT '["SATURDAY","SUNDAY"]',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HR Shift table
CREATE TABLE IF NOT EXISTS hr_shift (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration_min INT DEFAULT 60,
    is_night_shift BOOLEAN DEFAULT FALSE,
    grace_period_min INT DEFAULT 15,
    min_hours_full_day DECIMAL(4,2) DEFAULT 8.0,
    min_hours_half_day DECIMAL(4,2) DEFAULT 4.0,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_shift_institute ON hr_shift(institute_id);
