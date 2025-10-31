ALTER TABLE workflow_execution_log
ADD CONSTRAINT fk_workflow_execution_log_node_template
FOREIGN KEY (node_template_id)
REFERENCES node_template (id)
ON DELETE CASCADE;
