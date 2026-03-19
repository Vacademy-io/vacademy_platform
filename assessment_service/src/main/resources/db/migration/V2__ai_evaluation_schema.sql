-- AI Evaluation Process Table
-- Tracks the progress of AI evaluation for each student attempt
CREATE TABLE ai_evaluation_process (
    id VARCHAR(36) PRIMARY KEY,
    attempt_id VARCHAR(36) NOT NULL,
    assessment_id VARCHAR(36) NOT NULL,
    set_id VARCHAR(36),
    status VARCHAR(50) NOT NULL,
    current_section_id VARCHAR(36),
    current_question_index INT DEFAULT 0,
    total_questions INT,
    evaluation_json TEXT,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (attempt_id) REFERENCES student_attempt(id),
    FOREIGN KEY (assessment_id) REFERENCES assessment(id),
    FOREIGN KEY (set_id) REFERENCES assessment_set_mapping(id)
);

CREATE INDEX idx_attempt_status ON ai_evaluation_process(attempt_id, status);
CREATE INDEX idx_status_retry ON ai_evaluation_process(status, retry_count);

-- Evaluation Criteria Template Table
-- Stores reusable evaluation criteria templates for different subjects/question types
CREATE TABLE evaluation_criteria_template (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(100),
    question_type VARCHAR(50),
    criteria_json TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subject_type ON evaluation_criteria_template(subject, question_type);
CREATE INDEX idx_is_active ON evaluation_criteria_template(is_active);

-- Add evaluation criteria columns to question table
ALTER TABLE question 
ADD COLUMN evaluation_criteria_json TEXT,
ADD COLUMN criteria_template_id VARCHAR(36),
ADD CONSTRAINT fk_criteria_template 
    FOREIGN KEY (criteria_template_id) 
    REFERENCES evaluation_criteria_template(id);

-- Add AI evaluation tracking columns to question_wise_marks table
ALTER TABLE question_wise_marks
ADD COLUMN ai_evaluated_at TIMESTAMP,
ADD COLUMN ai_evaluation_details_json TEXT,
ADD COLUMN evaluator_feedback TEXT;
