-- Add notification configuration fields to audience table
-- These fields control email notifications when a form is submitted

-- Add to_notify column for comma-separated email addresses
ALTER TABLE audience 
ADD COLUMN to_notify TEXT;

-- Add send_respondent_email column to control respondent notifications
ALTER TABLE audience 
ADD COLUMN send_respondent_email BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN audience.to_notify IS 'Comma-separated email addresses for additional notification recipients when form is submitted';
COMMENT ON COLUMN audience.send_respondent_email IS 'Whether to send email notification to the respondent who submitted the form (default: true)';
