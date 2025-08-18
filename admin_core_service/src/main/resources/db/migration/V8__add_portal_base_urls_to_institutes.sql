-- Add portal base URL columns to institutes
-- Columns are nullable, with defaults

ALTER TABLE institutes
  ADD COLUMN IF NOT EXISTS learner_portal_base_url VARCHAR(255) DEFAULT 'learner.vacademy.io';

ALTER TABLE institutes
  ADD COLUMN IF NOT EXISTS teacher_portal_base_url VARCHAR(255) DEFAULT 'teacher.vacademy.io';

ALTER TABLE institutes
  ADD COLUMN IF NOT EXISTS admin_portal_base_url VARCHAR(255) DEFAULT 'dash.vacademy.io';


