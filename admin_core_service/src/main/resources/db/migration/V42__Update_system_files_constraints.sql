-- Update system_files table constraints for new file types and media types

-- Drop old file_type constraint
ALTER TABLE system_files DROP CONSTRAINT IF EXISTS chk_system_files_file_type;

-- Add new file_type constraint with Html
ALTER TABLE system_files ADD CONSTRAINT chk_system_files_file_type 
    CHECK (file_type IN ('File', 'Url', 'Html'));

-- Drop old status constraint
ALTER TABLE system_files DROP CONSTRAINT IF EXISTS chk_system_files_status;

-- Add new status constraint with ARCHIVED
ALTER TABLE system_files ADD CONSTRAINT chk_system_files_status 
    CHECK (status IN ('ACTIVE', 'DELETED', 'ARCHIVED'));

-- Update comments
COMMENT ON COLUMN system_files.file_type IS 'Type of file storage: File (stored file with ID), Url (external URL), or Html (HTML content/string)';
COMMENT ON COLUMN system_files.media_type IS 'Media category: video, audio, pdf, doc, image, note, or unknown';
COMMENT ON COLUMN system_files.status IS 'File status: ACTIVE, DELETED (soft delete), or ARCHIVED';
