-- Execution state table for pausable workflows (DELAY, APPROVAL nodes)
CREATE TABLE IF NOT EXISTS workflow_execution_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id VARCHAR(255) NOT NULL REFERENCES workflow_execution(id) ON DELETE CASCADE,
    paused_at_node_id VARCHAR(255) NOT NULL,
    serialized_context JSONB NOT NULL,
    resume_at TIMESTAMPTZ,
    pause_reason VARCHAR(50) NOT NULL, -- DELAY, APPROVAL, EXTERNAL_WAIT
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- WAITING, RESUMED, EXPIRED, CANCELLED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_exec_state_resume ON workflow_execution_state(status, resume_at)
    WHERE status = 'WAITING';
CREATE INDEX idx_wf_exec_state_execution ON workflow_execution_state(execution_id);
