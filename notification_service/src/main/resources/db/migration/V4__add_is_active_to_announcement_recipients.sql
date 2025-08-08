-- Add is_active column to announcement_recipients table
ALTER TABLE announcement_recipients 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_is_active ON announcement_recipients(is_active);
