-- Add launch_url column to store the media service file metadata ID of the launch file
ALTER TABLE scorm_slide ADD COLUMN launch_url VARCHAR(512);
