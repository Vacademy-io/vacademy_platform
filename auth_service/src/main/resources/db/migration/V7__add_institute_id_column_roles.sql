ALTER TABLE roles ADD COLUMN institute_id VARCHAR(255) DEFAULT NULL;
CREATE INDEX idx_roles_institute_id ON roles (institute_id);
