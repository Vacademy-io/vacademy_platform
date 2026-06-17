-- Adds support_ticket.client_context (auto-captured browser/device diagnostics + server-side IP,
-- shown only to the super-admin support console).
--
-- This column was introduced AFTER V14 had already been applied to some environments
-- (e.g. backend-stage), where the support_ticket table exists WITHOUT this column. Flyway never
-- re-runs an already-applied migration and would fail checksum validation if V14 were edited, so
-- the column is added here as a new migration instead. ADD COLUMN IF NOT EXISTS keeps it safe where
-- Hibernate ddl-auto (k8s-local) already created the column.
ALTER TABLE public.support_ticket ADD COLUMN IF NOT EXISTS client_context jsonb NULL;
