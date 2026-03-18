CREATE TABLE IF NOT EXISTS admission_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id VARCHAR(255) NOT NULL,
    package_session_id VARCHAR(255) NOT NULL,
    parent_user_id VARCHAR(255) NOT NULL,
    child_user_id VARCHAR(255) NOT NULL,
    enquiry_id VARCHAR(255),
    applicant_id VARCHAR(255),
    lead_status VARCHAR(50) NOT NULL,
    source_type VARCHAR(100),
    enquiry_date TIMESTAMP,
    application_date TIMESTAMP,
    admission_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admission_pipeline_institute_session ON admission_pipeline(institute_id, package_session_id);
CREATE INDEX idx_admission_pipeline_child_user ON admission_pipeline(child_user_id);
CREATE INDEX idx_admission_pipeline_parent_user ON admission_pipeline(parent_user_id);
CREATE INDEX idx_admission_pipeline_enquiry ON admission_pipeline(enquiry_id);
CREATE INDEX idx_admission_pipeline_applicant ON admission_pipeline(applicant_id);
