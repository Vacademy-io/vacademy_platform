-- workflow_execution_state.id was created as UUID (V180) but the JPA entity maps it
-- as a String (@UuidGenerator on a String field). Hibernate therefore binds a String
-- UUID, and Postgres rejects it:
--   ERROR: column "id" is of type uuid but expression is of type character varying
-- This failed EVERY pausable-workflow insert (DELAY/APPROVAL, and now the CALL_AI
-- retry loop), which rolled back the entire workflow execution — so no execution row,
-- no pause, no AI call. Align the column to VARCHAR(255) to match the entity and the
-- rest of the workflow schema (workflow_execution.id and execution_id are VARCHAR(255)).
ALTER TABLE workflow_execution_state ALTER COLUMN id DROP DEFAULT;
ALTER TABLE workflow_execution_state ALTER COLUMN id TYPE VARCHAR(255) USING id::text;
