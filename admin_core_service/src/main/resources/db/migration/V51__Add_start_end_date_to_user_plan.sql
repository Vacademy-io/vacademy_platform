-- Add start_date and end_date to user_plan
ALTER TABLE user_plan
    ADD COLUMN start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE user_plan
    ADD COLUMN end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
