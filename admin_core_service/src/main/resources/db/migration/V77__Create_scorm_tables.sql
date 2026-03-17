CREATE TABLE scorm_slide (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    original_file_id VARCHAR(255),
    launch_path VARCHAR(512),
    scorm_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scorm_learner_progress (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    slide_id VARCHAR(255) NOT NULL,
    attempt_number INT DEFAULT 1,
    
    -- Core SCORM Status
    completion_status VARCHAR(50),
    success_status VARCHAR(50),
    score_raw DOUBLE PRECISION,
    score_min DOUBLE PRECISION,
    score_max DOUBLE PRECISION,
    
    -- Session Time
    total_time VARCHAR(50),
    
    -- State Persistence
    cmi_suspend_data TEXT,
    cmi_location VARCHAR(255),
    cmi_exit VARCHAR(50),
    cmi_json JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_user_slide_attempt UNIQUE (user_id, slide_id, attempt_number)
);

-- Index for fast lookup of learner progress
CREATE INDEX idx_scorm_progress_user_slide ON scorm_learner_progress(user_id, slide_id);
