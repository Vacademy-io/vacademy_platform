CREATE TABLE workflow_trigger (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    trigger_event_name VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL,
    CONSTRAINT uq_workflow_trigger_id UNIQUE (id)
);

-- Indexes
CREATE INDEX idx_workflow_trigger_event_name ON workflow_trigger (trigger_event_name);
CREATE INDEX idx_workflow_trigger_institute_id ON workflow_trigger (institute_id);