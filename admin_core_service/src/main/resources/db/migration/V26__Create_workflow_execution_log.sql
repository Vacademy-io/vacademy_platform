CREATE TABLE IF NOT EXISTS workflow_execution_log (
    id varchar(255) PRIMARY KEY,
    workflow_execution_id varchar(255) NOT NULL,
    node_template_id varchar(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    execution_time_ms BIGINT,
    details_json TEXT, -- longtext replaced with JSONB
    error_message TEXT,
    error_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_workflow_execution_log_execution
        FOREIGN KEY (workflow_execution_id)
        REFERENCES workflow_execution (id)
        ON DELETE CASCADE
);

-- Indexes (Postgres Style)
CREATE INDEX IF NOT EXISTS idx_workflow_execution_id
    ON workflow_execution_log (workflow_execution_id);

CREATE INDEX IF NOT EXISTS idx_node_template_id
    ON workflow_execution_log (node_template_id);

CREATE INDEX IF NOT EXISTS idx_status
    ON workflow_execution_log (status);

CREATE INDEX IF NOT EXISTS idx_node_type
    ON workflow_execution_log (node_type);

CREATE INDEX IF NOT EXISTS idx_created_at
    ON workflow_execution_log (created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_exec_status
    ON workflow_execution_log (workflow_execution_id, status);
