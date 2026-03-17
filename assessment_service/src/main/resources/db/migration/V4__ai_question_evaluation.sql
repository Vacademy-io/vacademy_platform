-- Add real-time status tracking for AI evaluation
-- Migration: V3__realtime_evaluation_status.sql

-- Create table for per-question evaluation tracking
CREATE TABLE ai_question_evaluation (
    id VARCHAR(36) PRIMARY KEY,
    evaluation_process_id VARCHAR(36) NOT NULL,
    question_id VARCHAR(36) NOT NULL,
    question_wise_marks_id VARCHAR(36),
    question_number INT,
    
    -- Evaluation results (stored immediately after each question)
    evaluation_result_json TEXT,
    marks_awarded DECIMAL(10,2),
    max_marks DECIMAL(10,2),
    feedback TEXT,
    extracted_answer TEXT,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL, -- PENDING, EXTRACTING, EVALUATING, COMPLETED, FAILED
    
    -- Timestamps for tracking
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_question_eval_process FOREIGN KEY (evaluation_process_id) 
        REFERENCES ai_evaluation_process(id) ON DELETE CASCADE,
    CONSTRAINT fk_question_eval_question FOREIGN KEY (question_id) 
        REFERENCES question(id) ON DELETE CASCADE,
    CONSTRAINT fk_question_eval_marks FOREIGN KEY (question_wise_marks_id) 
        REFERENCES question_wise_marks(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_question_eval_process ON ai_question_evaluation(evaluation_process_id);
CREATE INDEX idx_question_eval_status ON ai_question_evaluation(evaluation_process_id, status);
CREATE INDEX idx_question_eval_completed ON ai_question_evaluation(evaluation_process_id, completed_at);

-- Add new columns to ai_evaluation_process for better tracking
ALTER TABLE ai_evaluation_process
ADD COLUMN current_step VARCHAR(50),
ADD COLUMN questions_completed INT DEFAULT 0,
ADD COLUMN questions_total INT DEFAULT 0;

-- Add comments using PostgreSQL COMMENT syntax
COMMENT ON COLUMN ai_evaluation_process.current_step IS 'Current detailed step: PROCESSING, EXTRACTION, CRITERIA_GENERATION, GRADING, STORING_RESULTS';
COMMENT ON COLUMN ai_evaluation_process.questions_completed IS 'Number of questions completed';
COMMENT ON COLUMN ai_evaluation_process.questions_total IS 'Total number of questions to evaluate';

-- Create index for progress tracking
CREATE INDEX idx_process_progress ON ai_evaluation_process(status, questions_completed, questions_total);
