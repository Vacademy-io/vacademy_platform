-- Create user_activity_log table for detailed activity tracking
CREATE TABLE user_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    institute_id VARCHAR(36),
    service_name VARCHAR(100),
    endpoint VARCHAR(500),
    action_type VARCHAR(50),
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device_type VARCHAR(50),
    response_status INTEGER,
    response_time_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_activity_user_id (user_id),
    INDEX idx_user_activity_institute_id (institute_id),
    INDEX idx_user_activity_created_at (created_at),
    INDEX idx_user_activity_user_institute_date (user_id, institute_id, created_at),
    INDEX idx_user_activity_service_name (service_name),
    INDEX idx_user_activity_session_id (session_id)
);

-- Create user_session table for session tracking
CREATE TABLE user_session (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    institute_id VARCHAR(36),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device_type VARCHAR(50),
    device_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP NULL,
    session_duration_minutes BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_session_user_id (user_id),
    INDEX idx_user_session_institute_id (institute_id),
    INDEX idx_user_session_token (session_token),
    INDEX idx_user_session_active (is_active),
    INDEX idx_user_session_login_time (login_time),
    INDEX idx_user_session_last_activity (last_activity_time),
    INDEX idx_user_session_user_institute (user_id, institute_id)
);

-- Create daily_user_activity_summary table for aggregated statistics
CREATE TABLE daily_user_activity_summary (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    institute_id VARCHAR(36) NOT NULL,
    activity_date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_activity_time_minutes BIGINT DEFAULT 0,
    total_api_calls INTEGER DEFAULT 0,
    unique_services_used INTEGER DEFAULT 0,
    first_activity_time TIMESTAMP NULL,
    last_activity_time TIMESTAMP NULL,
    services_used VARCHAR(1000),
    device_types_used VARCHAR(500),
    peak_activity_hour INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_user_institute_date (user_id, institute_id, activity_date),
    INDEX idx_daily_summary_user_id (user_id),
    INDEX idx_daily_summary_institute_id (institute_id),
    INDEX idx_daily_summary_activity_date (activity_date),
    INDEX idx_daily_summary_institute_date (institute_id, activity_date)
);

-- Add comments for documentation
ALTER TABLE user_activity_log COMMENT = 'Detailed log of all user activities across services';
ALTER TABLE user_session COMMENT = 'Active user sessions and session history';
ALTER TABLE daily_user_activity_summary COMMENT = 'Daily aggregated user activity statistics for efficient reporting';

-- Create indexes for common analytics queries
CREATE INDEX idx_activity_log_analytics ON user_activity_log (institute_id, created_at, user_id);
CREATE INDEX idx_session_analytics ON user_session (institute_id, is_active, last_activity_time);
CREATE INDEX idx_daily_summary_analytics ON daily_user_activity_summary (institute_id, activity_date, total_sessions);

-- Optional: Create partitions for user_activity_log by month for better performance
-- This can be implemented based on database engine (MySQL 8.0+, PostgreSQL)
-- 
-- For MySQL 8.0+:
-- ALTER TABLE user_activity_log 
-- PARTITION BY RANGE (TO_DAYS(created_at)) (
--     PARTITION p_2024_01 VALUES LESS THAN (TO_DAYS('2024-02-01')),
--     PARTITION p_2024_02 VALUES LESS THAN (TO_DAYS('2024-03-01')),
--     -- Add more partitions as needed
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- ); 