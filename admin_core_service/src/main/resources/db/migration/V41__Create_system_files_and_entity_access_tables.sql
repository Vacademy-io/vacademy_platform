
CREATE TABLE IF NOT EXISTS system_files (
    id                      VARCHAR(255) PRIMARY KEY,
    file_type               VARCHAR(50) NOT NULL,           -- File, Url
    media_type              VARCHAR(50) NOT NULL,           -- video, audio, pdf, doc, unknown
    data                    TEXT NOT NULL,                  -- fileId (UUID) or url
    name                    VARCHAR(255) NOT NULL,
    folder_name             VARCHAR(255),
    thumbnail_file_id       VARCHAR(255),                   -- Nullable thumbnail reference
    institute_id            VARCHAR(255) NOT NULL,
    created_by_user_id      VARCHAR(255) NOT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status                  VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,  -- ACTIVE, DELETED
    
    -- Foreign Key Constraints
    CONSTRAINT fk_system_files_institute 
        FOREIGN KEY (institute_id) 
        REFERENCES institutes(id) 
        ON DELETE CASCADE,
    
    -- Add constraint for file_type values
    CONSTRAINT chk_system_files_file_type 
        CHECK (file_type IN ('File', 'Url')),
    
    -- Add constraint for status values
    CONSTRAINT chk_system_files_status 
        CHECK (status IN ('ACTIVE', 'DELETED'))
);


CREATE TABLE IF NOT EXISTS entity_access (
    id                      VARCHAR(255) PRIMARY KEY,
    access_type             VARCHAR(50) NOT NULL,           -- view, edit
    level                   VARCHAR(50) NOT NULL,           -- user, batch, institute, role
    level_id                VARCHAR(255) NOT NULL,          -- userId, batchId, instituteId, or role name
    entity                  VARCHAR(100) NOT NULL,          -- system_file, assessment, video, etc.
    entity_id               VARCHAR(255) NOT NULL,          -- Reference to the entity (e.g., system_file_id)
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Add constraint for type values
    CONSTRAINT chk_entity_access_type 
        CHECK (access_type IN ('view', 'edit')),
    
    -- Add constraint for level values
    CONSTRAINT chk_entity_access_level 
        CHECK (level IN ('user', 'batch', 'institute', 'role'))
);

-- Create indexes for system_files table
CREATE INDEX idx_system_files_institute_id ON system_files(institute_id);
CREATE INDEX idx_system_files_status ON system_files(status) WHERE status <> 'DELETED';

-- Create indexes for entity_access table
CREATE INDEX idx_entity_access_entity_id ON entity_access(entity_id);
CREATE INDEX idx_entity_access_level_id ON entity_access(level_id);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_entity_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER trigger_system_files_updated_at
    BEFORE UPDATE ON system_files
    FOR EACH ROW
    EXECUTE FUNCTION update_system_files_updated_at();

CREATE TRIGGER trigger_entity_access_updated_at
    BEFORE UPDATE ON entity_access
    FOR EACH ROW
    EXECUTE FUNCTION update_entity_access_updated_at();

-- Add comments for documentation
COMMENT ON TABLE system_files IS 'Stores system files that can be linked to batch, user, or institute with access controls';
COMMENT ON COLUMN system_files.file_type IS 'Type of file storage: File (stored file with ID) or Url (external URL)';
COMMENT ON COLUMN system_files.media_type IS 'Media category: video, audio, pdf, doc, or unknown';
COMMENT ON COLUMN system_files.data IS 'File identifier (UUID) for stored files or URL for external files';
COMMENT ON COLUMN system_files.thumbnail_file_id IS 'Optional thumbnail file reference';
COMMENT ON COLUMN system_files.status IS 'File status: ACTIVE or DELETED (soft delete)';

COMMENT ON TABLE entity_access IS 'Manages access permissions for various entities with support for user, batch, institute, and role-based access';
COMMENT ON COLUMN entity_access.access_type IS 'Access type: view (read access) or edit (write access)';
COMMENT ON COLUMN entity_access.level IS 'Access level: user, batch, institute, or role';
COMMENT ON COLUMN entity_access.level_id IS 'ID corresponding to the access level (userId, batchId, instituteId, or role name)';
COMMENT ON COLUMN entity_access.entity IS 'Entity type this access applies to (system_file, assessment, video, etc.)';
COMMENT ON COLUMN entity_access.entity_id IS 'Specific entity instance ID';