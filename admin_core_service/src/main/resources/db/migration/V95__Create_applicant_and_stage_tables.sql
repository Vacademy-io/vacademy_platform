-- 1. Create Applicant Table
CREATE TABLE IF NOT EXISTS applicant (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id                 VARCHAR(255),
    application_stage_id        VARCHAR(255),
    application_stage_status    VARCHAR(255),
    overall_status              VARCHAR(255),
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for frequent lookups
CREATE INDEX idx_applicant_tracking_id ON applicant(tracking_id);
CREATE INDEX idx_applicant_app_stage_id ON applicant(application_stage_id);

-- 2. Create Application Stage Table
CREATE TABLE IF NOT EXISTS application_stage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_name      VARCHAR(255),
    sequence        VARCHAR(255),
    source          VARCHAR(255),
    source_id       VARCHAR(255),
    institute_id    VARCHAR(255),
    config_json     TEXT,
    type            VARCHAR(255)
);

-- Indexes for polymorphic source and institute lookups
CREATE INDEX idx_application_stage_source ON application_stage(source, source_id);
CREATE INDEX idx_application_stage_institute ON application_stage(institute_id);

-- 3. Create Applicant Stage Table
CREATE TABLE IF NOT EXISTS applicant_stage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id        VARCHAR(255),
    stage_status    VARCHAR(255),
    response_json   TEXT,
    applicant_id    VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for joining with applicant and generic stage lookups
CREATE INDEX idx_applicant_stage_applicant_id ON applicant_stage(applicant_id);
CREATE INDEX idx_applicant_stage_stage_id ON applicant_stage(stage_id);

-- 4. Add applicant_id to audience_response Table
ALTER TABLE audience_response
ADD COLUMN applicant_id VARCHAR(255);

CREATE INDEX idx_audience_response_applicant_id ON audience_response(applicant_id);
