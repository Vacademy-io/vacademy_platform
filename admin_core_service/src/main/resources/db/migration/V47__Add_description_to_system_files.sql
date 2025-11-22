-- Add description column to system_files table
ALTER TABLE system_files
ADD COLUMN description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN system_files.description IS 'Optional description for the system file';
