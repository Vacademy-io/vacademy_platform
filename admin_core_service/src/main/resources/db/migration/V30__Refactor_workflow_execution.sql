ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_execution_id_key;
ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_schedule_run_id_key;
ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_current_node_link_id_fkey;
ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_schedule_id_fkey;
ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_schedule_run_id_fkey;
ALTER TABLE workflow_execution DROP CONSTRAINT IF EXISTS workflow_execution_workflow_id_fkey;

DROP INDEX IF EXISTS idx_wf_exec_schedule;
DROP INDEX IF EXISTS idx_wf_exec_wf_status;

ALTER TABLE workflow_execution DROP COLUMN IF EXISTS execution_id;
ALTER TABLE workflow_execution DROP COLUMN IF EXISTS schedule_run_id;
ALTER TABLE workflow_execution DROP COLUMN IF EXISTS current_node_link_id;
ALTER TABLE workflow_execution DROP COLUMN IF EXISTS input_data;
ALTER TABLE workflow_execution DROP COLUMN IF EXISTS output_data;
ALTER TABLE workflow_execution DROP COLUMN IF EXISTS schedule_id;

ALTER TABLE workflow_execution 
    ADD COLUMN IF NOT EXISTS workflow_schedule_id VARCHAR,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR NOT NULL,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;

ALTER TABLE workflow_execution ALTER COLUMN status TYPE VARCHAR;
ALTER TABLE workflow_execution ALTER COLUMN status SET NOT NULL;

ALTER TABLE workflow_execution ALTER COLUMN started_at TYPE TIMESTAMP;
ALTER TABLE workflow_execution ALTER COLUMN started_at SET NOT NULL;

ALTER TABLE workflow_execution ALTER COLUMN completed_at TYPE TIMESTAMP;

ALTER TABLE workflow_execution 
    ADD CONSTRAINT fk_workflow_execution_workflow 
    FOREIGN KEY (workflow_id) 
    REFERENCES workflow(id) 
    ON DELETE CASCADE;

ALTER TABLE workflow_execution 
    ADD CONSTRAINT fk_workflow_execution_schedule 
    FOREIGN KEY (workflow_schedule_id) 
    REFERENCES workflow_schedule(id) 
    ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_execution_idempotency_key 
    ON workflow_execution(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_workflow_id 
    ON workflow_execution(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_schedule_id 
    ON workflow_execution(workflow_schedule_id);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_status 
    ON workflow_execution(status);

