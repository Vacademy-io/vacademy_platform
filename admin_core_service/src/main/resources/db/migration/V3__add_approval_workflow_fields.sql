-- Migration for Teacher Approval Workflow
-- Adds parent_id and created_by_user_id fields to support course copying and tracking

-- Add fields to package table for course approval workflow
ALTER TABLE package ADD COLUMN IF NOT EXISTS original_course_id VARCHAR(255);
ALTER TABLE package ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE package ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_package_original_course_id ON package(original_course_id);
CREATE INDEX IF NOT EXISTS idx_package_created_by_user_id ON package(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_package_status_created_by ON package(status, created_by_user_id);

-- Add fields to subject table
ALTER TABLE subject ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255);
ALTER TABLE subject ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);

-- Add indexes for subject
CREATE INDEX IF NOT EXISTS idx_subject_parent_id ON subject(parent_id);
CREATE INDEX IF NOT EXISTS idx_subject_created_by_user_id ON subject(created_by_user_id);

-- Add fields to modules table  
ALTER TABLE modules ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);

-- Add indexes for modules
CREATE INDEX IF NOT EXISTS idx_modules_parent_id ON modules(parent_id);
CREATE INDEX IF NOT EXISTS idx_modules_created_by_user_id ON modules(created_by_user_id);

-- Add fields to chapter table
ALTER TABLE chapter ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255);
ALTER TABLE chapter ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);

-- Add indexes for chapter
CREATE INDEX IF NOT EXISTS idx_chapter_parent_id ON chapter(parent_id);
CREATE INDEX IF NOT EXISTS idx_chapter_created_by_user_id ON chapter(created_by_user_id);

-- Add fields to slide table
ALTER TABLE slide ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255);
ALTER TABLE slide ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);

-- Add indexes for slide
CREATE INDEX IF NOT EXISTS idx_slide_parent_id ON slide(parent_id);
CREATE INDEX IF NOT EXISTS idx_slide_created_by_user_id ON slide(created_by_user_id);

-- Add foreign key constraints (optional, can be added later if needed)
-- ALTER TABLE package ADD CONSTRAINT fk_package_original_course FOREIGN KEY (original_course_id) REFERENCES package(id);
-- ALTER TABLE subject ADD CONSTRAINT fk_subject_parent FOREIGN KEY (parent_id) REFERENCES subject(id);
-- ALTER TABLE modules ADD CONSTRAINT fk_modules_parent FOREIGN KEY (parent_id) REFERENCES modules(id);
-- ALTER TABLE chapter ADD CONSTRAINT fk_chapter_parent FOREIGN KEY (parent_id) REFERENCES chapter(id);
-- ALTER TABLE slide ADD CONSTRAINT fk_slide_parent FOREIGN KEY (parent_id) REFERENCES slide(id);

-- Comments for documentation
COMMENT ON COLUMN package.original_course_id IS 'ID of the original course when this is a temporary copy for editing';
COMMENT ON COLUMN package.created_by_user_id IS 'ID of the user who created this course (for teacher approval workflow)';
COMMENT ON COLUMN package.version_number IS 'Version number for tracking course iterations';
COMMENT ON COLUMN subject.parent_id IS 'ID of the original subject when this is a copy';
COMMENT ON COLUMN subject.created_by_user_id IS 'ID of the user who created this subject';
COMMENT ON COLUMN modules.parent_id IS 'ID of the original module when this is a copy';
COMMENT ON COLUMN modules.created_by_user_id IS 'ID of the user who created this module';
COMMENT ON COLUMN chapter.parent_id IS 'ID of the original chapter when this is a copy';
COMMENT ON COLUMN chapter.created_by_user_id IS 'ID of the user who created this chapter';
COMMENT ON COLUMN slide.parent_id IS 'ID of the original slide when this is a copy';
COMMENT ON COLUMN slide.created_by_user_id IS 'ID of the user who created this slide'; 